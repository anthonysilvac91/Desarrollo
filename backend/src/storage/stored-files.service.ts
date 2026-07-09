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
  entityType: string;
  entityId: string;
  uploadedByUserId?: string | null;
}

@Injectable()
export class StoredFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async registerFile(input: RegisterStoredFileInput) {
    const sizeBytes = input.sizeBytes ?? 0;

    const [storedFile] = await this.prisma.$transaction([
      this.prisma.storedFile.create({
        data: {
          organization_id: input.organizationId,
          storage_ref: input.storageRef,
          original_name: input.originalName ?? null,
          mime_type: input.mimeType ?? null,
          size_bytes: input.sizeBytes ?? null,
          kind: input.kind,
          visibility: input.visibility === 'public' ? 'PUBLIC' : 'PRIVATE',
          entity_type: input.entityType,
          entity_id: input.entityId,
          uploaded_by_user_id: input.uploadedByUserId ?? null,
        },
      }),
      ...(sizeBytes > 0
        ? [
            this.prisma.organizationStorageUsage.upsert({
              where: { organization_id: input.organizationId },
              create: {
                organization_id: input.organizationId,
                ready_bytes: BigInt(sizeBytes),
                ready_file_count: 1,
              },
              update: {
                ready_bytes: { increment: BigInt(sizeBytes) },
                ready_file_count: { increment: 1 },
              },
            }),
          ]
        : []),
    ]);

    return storedFile;
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

  async resolveFileUrlForOrg(
    storedFileId: string | null | undefined,
    organizationId: string | null | undefined,
  ): Promise<string | null> {
    if (!storedFileId || !organizationId) return null;

    const storedFile = await this.prisma.storedFile.findUnique({
      where: { id: storedFileId },
      select: { storage_ref: true, organization_id: true },
    });

    if (!storedFile || storedFile.organization_id !== organizationId) {
      return null;
    }

    return this.storageService.resolveFileUrl(storedFile.storage_ref);
  }

  /**
   * Batch version of resolveFileUrlForOrg. Executes a single DB query for all
   * provided IDs within the given organization. Returns a Map keyed by fileId;
   * IDs not found, belonging to another org, or otherwise unresolvable map to
   * null (absent from the Map — callers should use `map.get(id) ?? null`).
   */
  async resolveFileUrlsForOrg(
    fileIds: Array<string | null | undefined>,
    organizationId: string | null | undefined,
  ): Promise<Map<string, string | null>> {
    if (!organizationId) return new Map();

    const uniqueIds = [
      ...new Set(fileIds.filter((id): id is string => !!id && id.length > 0)),
    ];
    if (uniqueIds.length === 0) return new Map();

    const storedFiles = await this.prisma.storedFile.findMany({
      where: { id: { in: uniqueIds }, organization_id: organizationId },
      select: { id: true, storage_ref: true },
    });

    const result = new Map<string, string | null>();
    await Promise.all(
      storedFiles.map(async (file) => {
        const url = await this.storageService.resolveFileUrl(file.storage_ref);
        result.set(file.id, url ?? null);
      }),
    );
    return result;
  }

  async resolveFileUrlOrRef(
    storedFileId?: string | null,
    legacyStorageRef?: string | null,
  ): Promise<string | null> {
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
        select: { storage_ref: true, organization_id: true, size_bytes: true },
      });

      if (storedFile?.storage_ref) {
        this.storageService.invalidateSignedUrlCache(storedFile.storage_ref);
        await this.storageService.deleteFile(storedFile.storage_ref);
      }

      const deleteQuery = this.prisma.storedFile.deleteMany({
        where: { id: storedFileId },
      });

      if (storedFile && storedFile.size_bytes) {
        await this.prisma.$transaction([
          deleteQuery,
          this.prisma.$executeRaw`
            UPDATE "OrganizationStorageUsage"
            SET "ready_bytes" = GREATEST("ready_bytes" - ${BigInt(storedFile.size_bytes)}, 0),
                "ready_file_count" = GREATEST("ready_file_count" - 1, 0),
                "updated_at" = NOW()
            WHERE "organization_id" = ${storedFile.organization_id}
          `,
        ]);
      } else {
        await deleteQuery;
      }
      return;
    }
  }
}
