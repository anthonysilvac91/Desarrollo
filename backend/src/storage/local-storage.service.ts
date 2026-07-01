import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { getExtensionForMime } from '../common/files/image-validation';
import { StorageService, UploadFileOptions } from './storage.service';

@Injectable()
export class LocalStorageService extends StorageService {
  private readonly uploadDir: string;
  private readonly canonicalUploadDir: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    super();
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR', './uploads');
    this.canonicalUploadDir = path.resolve(this.uploadDir);
    this.baseUrl = this.configService.get<string>(
      'BASE_URL',
      'http://localhost:3000',
    );

    if (!fs.existsSync(this.canonicalUploadDir)) {
      fs.mkdirSync(this.canonicalUploadDir, { recursive: true });
    }
  }

  uploadFile(
    file: Express.Multer.File,
    options: UploadFileOptions = {},
  ): Promise<string> {
    return Promise.resolve().then(() => {
      const folder = options.folder ?? '';
      const targetDir = this.resolveInsideUploadDir(folder, {
        allowMissingLeaf: true,
        requireUploadsPrefix: false,
      });
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const fileExt =
        getExtensionForMime(file.mimetype) || path.extname(file.originalname);
      const fileName = `${randomUUID()}${fileExt}`;
      const filePath = path.join(targetDir, fileName);

      fs.writeFileSync(filePath, file.buffer);

      const relativePath = folder ? `${folder}/${fileName}` : fileName;
      return `/uploads/${relativePath}`;
    });
  }

  resolveFileUrl(fileRef: string): Promise<string> {
    return Promise.resolve(fileRef);
  }

  deleteFile(fileRef: string): Promise<void> {
    return Promise.resolve().then(() => {
      const filePath = this.resolveInsideUploadDir(fileRef, {
        allowMissingLeaf: true,
        requireUploadsPrefix: true,
      });
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  }

  canHandleFileRef(fileRef: string): boolean {
    return fileRef.startsWith('/uploads/');
  }

  getFileSize(fileRef: string): Promise<number | null> {
    return Promise.resolve().then(() => {
      if (!this.canHandleFileRef(fileRef)) {
        this.rejectSuspiciousNonUploadRef(fileRef);
        return null;
      }

      const filePath = this.resolveInsideUploadDir(fileRef, {
        allowMissingLeaf: false,
        requireUploadsPrefix: true,
      });
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const stat = fs.statSync(filePath);
      if (!stat.isFile()) {
        throw new BadRequestException('Invalid storage path');
      }

      return stat.size;
    });
  }

  listFileRefs(prefix = ''): Promise<string[]> {
    return Promise.resolve().then(() => {
      const startDir = prefix
        ? this.resolveInsideUploadDir(prefix, {
            allowMissingLeaf: false,
            requireUploadsPrefix: false,
          })
        : this.canonicalUploadDir;

      if (!fs.existsSync(startDir)) {
        return [];
      }

      const refs: string[] = [];
      const walk = (currentDir: string) => {
        for (const entry of fs.readdirSync(currentDir, {
          withFileTypes: true,
        })) {
          const absolutePath = path.join(currentDir, entry.name);
          const realPath = this.realPathIfExists(absolutePath);
          if (realPath && !this.isInsideUploadDir(realPath)) {
            throw new BadRequestException('Invalid storage path');
          }
          if (entry.isDirectory()) {
            walk(absolutePath);
            continue;
          }

          const relativePath = path
            .relative(this.canonicalUploadDir, absolutePath)
            .split(path.sep)
            .join('/');
          refs.push(`/uploads/${relativePath}`);
        }
      };

      walk(startDir);
      return refs;
    });
  }

  private resolveInsideUploadDir(
    input: string,
    options: { allowMissingLeaf: boolean; requireUploadsPrefix: boolean },
  ): string {
    const relativePath = this.normalizeStorageInput(
      input,
      options.requireUploadsPrefix,
    );
    const resolvedPath = path.resolve(this.canonicalUploadDir, relativePath);
    if (!this.isInsideUploadDir(resolvedPath)) {
      throw new BadRequestException('Invalid storage path');
    }

    const realPath = this.realPathIfExists(resolvedPath);
    if (realPath && !this.isInsideUploadDir(realPath)) {
      throw new BadRequestException('Invalid storage path');
    }

    if (!realPath && !options.allowMissingLeaf) {
      const existingParent = this.findExistingParent(resolvedPath);
      const realParent = this.realPathIfExists(existingParent);
      if (!realParent || !this.isInsideUploadDir(realParent)) {
        throw new BadRequestException('Invalid storage path');
      }
    }

    return resolvedPath;
  }

  private normalizeStorageInput(
    input: string,
    requireUploadsPrefix: boolean,
  ): string {
    let decoded: string;
    try {
      decoded = decodeURIComponent(input);
    } catch {
      throw new BadRequestException('Invalid storage path');
    }

    if (decoded.includes('\\')) {
      throw new BadRequestException('Invalid storage path');
    }

    const normalized = decoded.replace(/^\/+|\/+$/g, '');
    if (requireUploadsPrefix) {
      if (!decoded.startsWith('/uploads/')) {
        throw new BadRequestException('Invalid storage path');
      }
      return normalized.slice('uploads/'.length);
    }

    if (path.isAbsolute(decoded) || normalized.startsWith('uploads/')) {
      throw new BadRequestException('Invalid storage path');
    }

    return normalized;
  }

  private rejectSuspiciousNonUploadRef(input: string): void {
    let decoded = input;
    try {
      decoded = decodeURIComponent(input);
    } catch {
      throw new BadRequestException('Invalid storage path');
    }

    if (
      path.isAbsolute(decoded) ||
      decoded.includes('\\') ||
      decoded.includes('..')
    ) {
      throw new BadRequestException('Invalid storage path');
    }
  }

  private isInsideUploadDir(candidatePath: string): boolean {
    const relative = path.relative(this.canonicalUploadDir, candidatePath);
    return (
      relative === '' ||
      (!relative.startsWith('..') && !path.isAbsolute(relative))
    );
  }

  private realPathIfExists(candidatePath: string): string | null {
    try {
      return fs.realpathSync(candidatePath);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return null;
      }
      throw error;
    }
  }

  private findExistingParent(candidatePath: string): string {
    let current = path.dirname(candidatePath);
    while (!fs.existsSync(current)) {
      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
    return current;
  }
}
