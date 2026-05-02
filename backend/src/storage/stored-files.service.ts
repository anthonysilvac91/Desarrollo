import { Injectable } from '@nestjs/common';
import { StoredFileKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, StorageVisibility } from './storage.service';

interface RegisterStoredFileInput {
  organizationId: string;
  storageRef: string;
  originalName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  kind: StoredFileKind;
  visibility: StorageVisibility;
  ownerType: string;
  ownerId: string;
  uploadedByUserId?: string | null;
}

@Injectable()
export class StoredFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async registerFile(input: RegisterStoredFileInput) {
    return this.prisma.storedFile.create({
      data: {
        organization_id: input.organizationId,
        storage_ref: input.storageRef,
        original_name: input.originalName ?? null,
        mime_type: input.mimeType ?? null,
        size_bytes: input.sizeBytes ?? null,
        kind: input.kind,
        visibility: input.visibility === 'public' ? 'PUBLIC' : 'PRIVATE',
        owner_type: input.ownerType,
        owner_id: input.ownerId,
        uploaded_by_user_id: input.uploadedByUserId ?? null,
      },
    });
  }

  async registerUploadedFile(input: RegisterStoredFileInput) {
    try {
      return await this.registerFile(input);
    } catch (error) {
      await this.storageService.deleteFile(input.storageRef);
      throw error;
    }
  }

  async resolveFileUrl(storedFileId?: string | null): Promise<string | null> {
    if (storedFileId) {
      const storedFile = await this.prisma.storedFile.findUnique({
        where: { id: storedFileId },
        select: { storage_ref: true },
      });

      if (storedFile?.storage_ref) {
        return this.storageService.resolveFileUrl(storedFile.storage_ref);
      }
    }

    return null;
  }

  async resolveFileUrlOrRef(storedFileId?: string | null, legacyStorageRef?: string | null): Promise<string | null> {
    const resolvedStoredFileUrl = await this.resolveFileUrl(storedFileId);
    if (resolvedStoredFileUrl) {
      return resolvedStoredFileUrl;
    }

    if (!legacyStorageRef) {
      return null;
    }

    return this.storageService.canHandleFileRef(legacyStorageRef)
      ? this.storageService.resolveFileUrl(legacyStorageRef)
      : legacyStorageRef;
  }

  async deleteStoredFileAndBlob(storedFileId?: string | null): Promise<void> {
    if (storedFileId) {
      const storedFile = await this.prisma.storedFile.findUnique({
        where: { id: storedFileId },
        select: { storage_ref: true },
      });

      if (storedFile?.storage_ref) {
        await this.storageService.deleteFile(storedFile.storage_ref);
      }

      await this.prisma.storedFile.deleteMany({
        where: { id: storedFileId },
      });
      return;
    }
  }
}
