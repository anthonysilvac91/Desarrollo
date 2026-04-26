import { Injectable } from '@nestjs/common';
import { StorageService } from './storage.service';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { UploadFileOptions } from './storage.service';

@Injectable()
export class LocalStorageService extends StorageService {
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    super();
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR', './uploads');
    this.baseUrl = this.configService.get<string>('BASE_URL', 'http://localhost:3000');
    
    // Asegurar que el directorio existe
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(file: Express.Multer.File, options: UploadFileOptions = {}): Promise<string> {
    const folder = options.folder ?? '';
    const targetDir = path.join(this.uploadDir, folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const fileExt = path.extname(file.originalname);
    const fileName = `${randomUUID()}${fileExt}`;
    const filePath = path.join(targetDir, fileName);

    fs.writeFileSync(filePath, file.buffer);

    // Retornamos URL relativa para compatibilidad con backend estático actual
    // Si folder existe, incluimos en el path
    const relativePath = folder ? `${folder}/${fileName}` : fileName;
    return `/uploads/${relativePath}`;
  }

  async resolveFileUrl(fileRef: string): Promise<string> {
    return fileRef;
  }

  async deleteFile(fileRef: string): Promise<void> {
    const fileName = fileRef.replace('/uploads/', '');
    const filePath = path.join(this.uploadDir, fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  canHandleFileRef(fileRef: string): boolean {
    return fileRef.startsWith('/uploads/');
  }

  async getFileSize(fileRef: string): Promise<number | null> {
    if (!this.canHandleFileRef(fileRef)) {
      return null;
    }

    const fileName = fileRef.replace('/uploads/', '');
    const filePath = path.join(this.uploadDir, fileName);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return fs.statSync(filePath).size;
  }

  async listFileRefs(prefix = ''): Promise<string[]> {
    const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, '');
    const startDir = normalizedPrefix
      ? path.join(this.uploadDir, normalizedPrefix)
      : this.uploadDir;

    if (!fs.existsSync(startDir)) {
      return [];
    }

    const refs: string[] = [];

    const walk = (currentDir: string) => {
      for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
        const absolutePath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          walk(absolutePath);
          continue;
        }

        const relativePath = path.relative(this.uploadDir, absolutePath).split(path.sep).join('/');
        refs.push(`/uploads/${relativePath}`);
      }
    };

    walk(startDir);
    return refs;
  }
}
