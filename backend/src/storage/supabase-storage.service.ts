import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { StorageService, UploadFileOptions } from './storage.service';

const PRIVATE_REF_PREFIX = 'private://';
const PUBLIC_STORAGE_PATH_PREFIX = '/storage/v1/object/public/';

@Injectable()
export class SupabaseStorageService extends StorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly supabase: SupabaseClient;
  private readonly publicBucket: string;
  private readonly privateBucket: string;
  private readonly signedUrlTtlSeconds: number;

  constructor(private configService: ConfigService) {
    super();
    const url = this.configService.get<string>('SUPABASE_URL');
    const key = this.configService.get<string>('SUPABASE_KEY');
    this.publicBucket = this.configService.get<string>('SUPABASE_PUBLIC_BUCKET', 'recall-branding');
    this.privateBucket = this.configService.get<string>('SUPABASE_PRIVATE_BUCKET', 'recall-private');
    this.signedUrlTtlSeconds = this.configService.get<number>('SIGNED_URL_TTL_SECONDS', 3600);

    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_KEY must be defined for Supabase storage');
    }

    this.supabase = createClient(url, key);
  }

  private buildPrivateRef(filePath: string): string {
    return `${PRIVATE_REF_PREFIX}${this.privateBucket}/${filePath}`;
  }

  private parsePrivateRef(fileRef: string): { bucket: string; filePath: string } | null {
    if (!fileRef.startsWith(PRIVATE_REF_PREFIX)) {
      return null;
    }

    const rawPath = fileRef.slice(PRIVATE_REF_PREFIX.length);
    const slashIndex = rawPath.indexOf('/');
    if (slashIndex === -1) {
      return null;
    }

    return {
      bucket: rawPath.slice(0, slashIndex),
      filePath: rawPath.slice(slashIndex + 1),
    };
  }

  private parsePublicUrl(fileRef: string): { bucket: string; filePath: string } | null {
    try {
      const publicUrl = new URL(fileRef);
      const prefixIndex = publicUrl.pathname.indexOf(PUBLIC_STORAGE_PATH_PREFIX);
      if (prefixIndex === -1) {
        return null;
      }

      const bucketPath = publicUrl.pathname.slice(prefixIndex + PUBLIC_STORAGE_PATH_PREFIX.length);
      const slashIndex = bucketPath.indexOf('/');
      if (slashIndex === -1) {
        return null;
      }

      return {
        bucket: bucketPath.slice(0, slashIndex),
        filePath: bucketPath.slice(slashIndex + 1),
      };
    } catch {
      return null;
    }
  }

  async uploadFile(file: Express.Multer.File, options: UploadFileOptions = {}): Promise<string> {
    const folder = options.folder ?? '';
    const visibility = options.visibility ?? 'private';
    const bucket = visibility === 'public' ? this.publicBucket : this.privateBucket;
    const fileExt = path.extname(file.originalname);
    const fileName = `${randomUUID()}${fileExt}`;
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      this.logger.error(`Error uploading to Supabase: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Could not upload file: ${error.message}`);
    }

    if (visibility === 'private') {
      return this.buildPrivateRef(filePath);
    }

    const { data } = this.supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async resolveFileUrl(fileRef: string): Promise<string> {
    const privateRef = this.parsePrivateRef(fileRef);
    if (!privateRef) {
      return fileRef;
    }

    const { data, error } = await this.supabase.storage
      .from(privateRef.bucket)
      .createSignedUrl(privateRef.filePath, this.signedUrlTtlSeconds);

    if (error || !data?.signedUrl) {
      this.logger.error(`Error creating signed URL: ${error?.message ?? 'unknown error'}`);
      throw new InternalServerErrorException('Could not resolve private file URL');
    }

    return data.signedUrl;
  }

  async deleteFile(fileRef: string): Promise<void> {
    const privateRef = this.parsePrivateRef(fileRef);
    if (privateRef) {
      const { error } = await this.supabase.storage
        .from(privateRef.bucket)
        .remove([privateRef.filePath]);

      if (error) {
        this.logger.error(`Error deleting private file from Supabase: ${error.message}`, error.stack);
      }

      return;
    }

    const publicRef = this.parsePublicUrl(fileRef);
    if (!publicRef) {
      return;
    }

    const { error } = await this.supabase.storage
      .from(publicRef.bucket)
      .remove([publicRef.filePath]);

    if (error) {
      this.logger.error(`Error deleting public file from Supabase: ${error.message}`, error.stack);
    }
  }
}
