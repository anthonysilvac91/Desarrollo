import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LocalStorageService } from './local-storage.service';

describe('LocalStorageService path safety', () => {
  let root: string;
  let outsideRoot: string;
  let service: LocalStorageService;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'local-storage-'));
    outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-storage-'));
    service = new LocalStorageService({
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'UPLOAD_DIR') return root;
        return fallback;
      }),
    } as unknown as ConfigService);
    fs.mkdirSync(path.join(root, 'org-1'), { recursive: true });
    fs.writeFileSync(path.join(root, 'org-1', 'file.txt'), 'ok');
    fs.writeFileSync(path.join(outsideRoot, 'outside.txt'), 'secret');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outsideRoot, { recursive: true, force: true });
  });

  it('permite paths normales bajo /uploads', async () => {
    await expect(service.getFileSize('/uploads/org-1/file.txt')).resolves.toBe(
      2,
    );
  });

  it('rechaza traversal con ..', async () => {
    await expect(
      service.getFileSize('/uploads/../outside.txt'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza path absoluto', async () => {
    await expect(
      service.getFileSize(path.resolve(root, 'org-1/file.txt')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza traversal codificado', async () => {
    await expect(
      service.getFileSize('/uploads/%2e%2e/outside.txt'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza separadores alternativos', async () => {
    await expect(
      service.getFileSize('/uploads/org-1\\file.txt'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deleteFile nunca borra fuera de uploadDir', async () => {
    await expect(
      service.deleteFile('/uploads/../outside.txt'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fs.existsSync(path.join(outsideRoot, 'outside.txt'))).toBe(true);
  });

  it('listFileRefs no escapa de uploadDir', async () => {
    await expect(service.listFileRefs('../')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rechaza symlinks que apuntan fuera de uploadDir', async () => {
    const linkPath = path.join(root, 'linked-outside');
    try {
      fs.symlinkSync(outsideRoot, linkPath, 'dir');
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'EPERM'
      ) {
        return;
      }
      throw error;
    }

    await expect(service.listFileRefs('linked-outside')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
