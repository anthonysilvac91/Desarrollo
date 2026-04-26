import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { StorageService, UploadFileOptions } from './storage.service';
import { getExtensionForMime } from '../common/files/image-validation';

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

  canHandleFileRef(fileRef: string): boolean {
    return this.parsePrivateRef(fileRef) !== null || this.parsePublicUrl(fileRef) !== null;
  }

  async uploadFile(file: Express.Multer.File, options: UploadFileOptions = {}): Promise<string> {
    const folder = options.folder ?? '';
    const visibility = options.visibility ?? 'private';
    const bucket = visibility === 'public' ? this.publicBucket : this.privateBucket;
    const fileExt = getExtensionForMime(file.mimetype) || path.extname(file.originalname);
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

  async getFileSize(fileRef: string): Promise<number | null> {
    if (!this.canHandleFileRef(fileRef)) {
      return null;
    }

    const privateRef = this.parsePrivateRef(fileRef);
    if (privateRef) {
      return this.fetchObjectSize(privateRef.bucket, privateRef.filePath);
    }

    const publicRef = this.parsePublicUrl(fileRef);
    if (publicRef) {
      return this.fetchObjectSize(publicRef.bucket, publicRef.filePath);
    }

    return null;
  }

  async listFileRefs(prefix = ''): Promise<string[]> {
    const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, '');
    const publicRefs = await this.listBucketRefs(this.publicBucket, normalizedPrefix, 'public');
    const privateRefs = await this.listBucketRefs(this.privateBucket, normalizedPrefix, 'private');
    return [...publicRefs, ...privateRefs];
  }

  private async fetchObjectSize(bucket: string, filePath: string): Promise<number | null> {
    const normalizedFilePath = filePath.replace(/^\/+/, '');
    const lastSlashIndex = normalizedFilePath.lastIndexOf('/');
    const directory = lastSlashIndex === -1 ? '' : normalizedFilePath.slice(0, lastSlashIndex);
    const fileName = lastSlashIndex === -1 ? normalizedFilePath : normalizedFilePath.slice(lastSlashIndex + 1);

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .list(directory, {
        limit: 100,
        search: fileName,
      });

    if (error) {
      this.logger.error(`Error listing Supabase object size for ${bucket}/${filePath}: ${error.message}`, error.stack);
      return null;
    }

    const exactMatch = data?.find((entry: any) => entry.name === fileName);
    return typeof exactMatch?.metadata?.size === 'number' ? exactMatch.metadata.size : null;
  }

  private async listBucketRefs(
    bucket: string,
    prefix: string,
    visibility: 'public' | 'private',
    currentPath = '',
  ): Promise<string[]> {
    const targetPath = currentPath || prefix;
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .list(targetPath, {
        limit: 1000,
      });

    if (error) {
      this.logger.error(`Error listing Supabase bucket ${bucket} at ${targetPath}: ${error.message}`, error.stack);
      return [];
    }

    const refs: string[] = [];

    for (const entry of data ?? []) {
      const entryPath = targetPath ? `${targetPath}/${entry.name}` : entry.name;
      const isDirectory = !entry.metadata;

      if (isDirectory) {
        refs.push(...await this.listBucketRefs(bucket, prefix, visibility, entryPath));
        continue;
      }

      if (visibility === 'private') {
        refs.push(this.buildPrivateRef(entryPath));
        continue;
      }

      const { data: publicData } = this.supabase.storage
        .from(bucket)
        .getPublicUrl(entryPath);
      refs.push(publicData.publicUrl);
    }

    return refs;
  }
}
