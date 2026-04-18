import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { StorageService } from './storage.service';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import * as path from 'path';

@Injectable()
export class SupabaseStorageService extends StorageService {
  private supabase: SupabaseClient;
  private readonly bucket: string;

  constructor(private configService: ConfigService) {
    super();
    const url = this.configService.get<string>('SUPABASE_URL');
    const key = this.configService.get<string>('SUPABASE_KEY');
    this.bucket = this.configService.get<string>('SUPABASE_BUCKET', 'recall-attachments');

    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_KEY must be defined for Supabase storage');
    }

    this.supabase = createClient(url, key);
  }

  async uploadFile(file: Express.Multer.File, folder: string = ''): Promise<string> {
    const fileExt = path.extname(file.originalname);
    const fileName = `${randomUUID()}${fileExt}`;
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      console.error('Error uploading to Supabase:', error);
      throw new InternalServerErrorException(`Could not upload file: ${error.message}`);
    }

    const { data } = this.supabase.storage
      .from(this.bucket)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    // Extraer el path del bucket desde la URL pública
    // Ejemplo: https://xyz.supabase.co/storage/v1/object/public/recall-attachments/folder/file.jpg
    const parts = fileUrl.split(`${this.bucket}/`);
    const filePath = parts[parts.length - 1];

    if (filePath) {
      const { error } = await this.supabase.storage
        .from(this.bucket)
        .remove([filePath]);

      if (error) {
        console.error('Error deleting from Supabase:', error);
      }
    }
  }
}
