import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  PrismaClient,
  StoredFile,
  StoredFileKind,
  StoredFileVisibility,
} from '@prisma/client';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';

export interface StoredFilesBackfillOptions {
  dryRun?: boolean;
}

export interface StoredFilesBackfillSummary {
  scanned: number;
  linked: number;
  created: number;
  reused: number;
  skipped: number;
  warnings: number;
  sections: Record<string, StoredFilesBackfillSectionSummary>;
}

interface StoredFilesBackfillSectionSummary {
  scanned: number;
  linked: number;
  created: number;
  reused: number;
  skipped: number;
  warnings: number;
}

interface FileRegistrationInput {
  organizationId: string;
  storageRef: string;
  originalName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  kind: StoredFileKind;
  visibility: StoredFileVisibility;
  ownerType: string;
  ownerId: string;
  uploadedByUserId?: string | null;
}

const BATCH_SIZE = 100;

@Injectable()
export class StoredFilesBackfillService {
  private readonly logger = new Logger(StoredFilesBackfillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async backfill(options: StoredFilesBackfillOptions = {}): Promise<StoredFilesBackfillSummary> {
    const summary: StoredFilesBackfillSummary = {
      scanned: 0,
      linked: 0,
      created: 0,
      reused: 0,
      skipped: 0,
      warnings: 0,
      sections: {},
    };

    await this.backfillOrganizations(summary, options);
    await this.backfillUsers(summary, options);
    await this.backfillCompanies(summary, options);
    await this.backfillAssets(summary, options);
    await this.backfillServiceAttachments(summary, options);

    return summary;
  }

  private ensureSection(summary: StoredFilesBackfillSummary, key: string): StoredFilesBackfillSectionSummary {
    if (!summary.sections[key]) {
      summary.sections[key] = {
        scanned: 0,
        linked: 0,
        created: 0,
        reused: 0,
        skipped: 0,
        warnings: 0,
      };
    }

    return summary.sections[key];
  }

  private bump(
    summary: StoredFilesBackfillSummary,
    sectionKey: string,
    field: keyof Omit<StoredFilesBackfillSectionSummary, never>,
  ) {
    summary[field] += 1;
    this.ensureSection(summary, sectionKey)[field] += 1;
  }

  private async backfillOrganizations(
    summary: StoredFilesBackfillSummary,
    options: StoredFilesBackfillOptions,
  ) {
    let cursor: string | undefined;

    for (;;) {
      const rows = await this.prisma.organization.findMany({
        where: {
          logo_url: { not: null },
          logo_file_id: null,
        },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: {
          id: true,
          logo_url: true,
        },
      });

      if (rows.length === 0) {
        return;
      }

      for (const row of rows) {
        this.bump(summary, 'organizations', 'scanned');

        if (!row.logo_url) {
          this.bump(summary, 'organizations', 'skipped');
          continue;
        }

        await this.linkLegacyFile({
          sectionKey: 'organizations',
          summary,
          options,
          rowLabel: `organization:${row.id}`,
          input: {
            organizationId: row.id,
            storageRef: row.logo_url,
            originalName: this.extractOriginalName(row.logo_url),
            mimeType: this.inferMimeType(row.logo_url),
            sizeBytes: null,
            kind: StoredFileKind.ORG_LOGO,
            visibility: StoredFileVisibility.PUBLIC,
            ownerType: 'ORGANIZATION',
            ownerId: row.id,
          },
          assignStoredFileId: async (storedFileId) => {
            await this.prisma.organization.update({
              where: { id: row.id },
              data: { logo_file_id: storedFileId },
            });
          },
        });
      }

      cursor = rows[rows.length - 1].id;
    }
  }

  private async backfillUsers(
    summary: StoredFilesBackfillSummary,
    options: StoredFilesBackfillOptions,
  ) {
    let cursor: string | undefined;

    for (;;) {
      const rows = await this.prisma.user.findMany({
        where: {
          avatar_url: { not: null },
          avatar_file_id: null,
          organization_id: { not: null },
        },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: {
          id: true,
          organization_id: true,
          avatar_url: true,
        },
      });

      if (rows.length === 0) {
        return;
      }

      for (const row of rows) {
        this.bump(summary, 'users', 'scanned');

        if (!row.organization_id || !row.avatar_url) {
          this.bump(summary, 'users', 'skipped');
          continue;
        }

        await this.linkLegacyFile({
          sectionKey: 'users',
          summary,
          options,
          rowLabel: `user:${row.id}`,
          input: {
            organizationId: row.organization_id,
            storageRef: row.avatar_url,
            originalName: this.extractOriginalName(row.avatar_url),
            mimeType: this.inferMimeType(row.avatar_url),
            sizeBytes: null,
            kind: StoredFileKind.USER_AVATAR,
            visibility: StoredFileVisibility.PRIVATE,
            ownerType: 'USER',
            ownerId: row.id,
          },
          assignStoredFileId: async (storedFileId) => {
            await this.prisma.user.update({
              where: { id: row.id },
              data: { avatar_file_id: storedFileId },
            });
          },
        });
      }

      cursor = rows[rows.length - 1].id;
    }
  }

  private async backfillCompanies(
    summary: StoredFilesBackfillSummary,
    options: StoredFilesBackfillOptions,
  ) {
    let cursor: string | undefined;

    for (;;) {
      const rows = await this.prisma.company.findMany({
        where: {
          logo_url: { not: null },
          logo_file_id: null,
        },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: {
          id: true,
          organization_id: true,
          logo_url: true,
        },
      });

      if (rows.length === 0) {
        return;
      }

      for (const row of rows) {
        this.bump(summary, 'companies', 'scanned');

        if (!row.logo_url) {
          this.bump(summary, 'companies', 'skipped');
          continue;
        }

        await this.linkLegacyFile({
          sectionKey: 'companies',
          summary,
          options,
          rowLabel: `company:${row.id}`,
          input: {
            organizationId: row.organization_id,
            storageRef: row.logo_url,
            originalName: this.extractOriginalName(row.logo_url),
            mimeType: this.inferMimeType(row.logo_url),
            sizeBytes: null,
            kind: StoredFileKind.COMPANY_LOGO,
            visibility: StoredFileVisibility.PRIVATE,
            ownerType: 'COMPANY',
            ownerId: row.id,
          },
          assignStoredFileId: async (storedFileId) => {
            await this.prisma.company.update({
              where: { id: row.id },
              data: { logo_file_id: storedFileId },
            });
          },
        });
      }

      cursor = rows[rows.length - 1].id;
    }
  }

  private async backfillAssets(
    summary: StoredFilesBackfillSummary,
    options: StoredFilesBackfillOptions,
  ) {
    let cursor: string | undefined;

    for (;;) {
      const rows = await this.prisma.asset.findMany({
        where: {
          thumbnail_url: { not: null },
          thumbnail_file_id: null,
        },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: {
          id: true,
          organization_id: true,
          thumbnail_url: true,
        },
      });

      if (rows.length === 0) {
        return;
      }

      for (const row of rows) {
        this.bump(summary, 'assets', 'scanned');

        if (!row.thumbnail_url) {
          this.bump(summary, 'assets', 'skipped');
          continue;
        }

        await this.linkLegacyFile({
          sectionKey: 'assets',
          summary,
          options,
          rowLabel: `asset:${row.id}`,
          input: {
            organizationId: row.organization_id,
            storageRef: row.thumbnail_url,
            originalName: this.extractOriginalName(row.thumbnail_url),
            mimeType: this.inferMimeType(row.thumbnail_url),
            sizeBytes: null,
            kind: StoredFileKind.ASSET_THUMBNAIL,
            visibility: StoredFileVisibility.PRIVATE,
            ownerType: 'ASSET',
            ownerId: row.id,
          },
          assignStoredFileId: async (storedFileId) => {
            await this.prisma.asset.update({
              where: { id: row.id },
              data: { thumbnail_file_id: storedFileId },
            });
          },
        });
      }

      cursor = rows[rows.length - 1].id;
    }
  }

  private async backfillServiceAttachments(
    summary: StoredFilesBackfillSummary,
    options: StoredFilesBackfillOptions,
  ) {
    let cursor: string | undefined;

    for (;;) {
      const rows = await this.prisma.serviceAttachment.findMany({
        where: {
          file_id: null,
          file_url: { not: '' },
        },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: {
          id: true,
          file_url: true,
          file_type: true,
          file_name: true,
          file_size_bytes: true,
          service: {
            select: {
              id: true,
              organization_id: true,
              worker_id: true,
            },
          },
        },
      });

      if (rows.length === 0) {
        return;
      }

      for (const row of rows) {
        this.bump(summary, 'service_attachments', 'scanned');

        if (!row.file_url) {
          this.bump(summary, 'service_attachments', 'skipped');
          continue;
        }

        await this.linkLegacyFile({
          sectionKey: 'service_attachments',
          summary,
          options,
          rowLabel: `service_attachment:${row.id}`,
          input: {
            organizationId: row.service.organization_id,
            storageRef: row.file_url,
            originalName: row.file_name || this.extractOriginalName(row.file_url),
            mimeType: row.file_type || this.inferMimeType(row.file_url),
            sizeBytes: row.file_size_bytes ?? null,
            kind: StoredFileKind.SERVICE_ATTACHMENT,
            visibility: StoredFileVisibility.PRIVATE,
            ownerType: 'SERVICE',
            ownerId: row.service.id,
            uploadedByUserId: row.service.worker_id,
          },
          assignStoredFileId: async (storedFileId) => {
            await this.prisma.serviceAttachment.update({
              where: { id: row.id },
              data: { file_id: storedFileId },
            });
          },
        });
      }

      cursor = rows[rows.length - 1].id;
    }
  }

  private async linkLegacyFile(params: {
    sectionKey: string;
    summary: StoredFilesBackfillSummary;
    options: StoredFilesBackfillOptions;
    rowLabel: string;
    input: FileRegistrationInput;
    assignStoredFileId: (storedFileId: string) => Promise<void>;
  }) {
    const storedFile = await this.findOrCreateStoredFile(
      params.input,
      params.summary,
      params.sectionKey,
      params.options,
      params.rowLabel,
    );

    if (!params.options.dryRun) {
      await params.assignStoredFileId(storedFile.id);
    }

    this.bump(params.summary, params.sectionKey, 'linked');
  }

  private async findOrCreateStoredFile(
    input: FileRegistrationInput,
    summary: StoredFilesBackfillSummary,
    sectionKey: string,
    options: StoredFilesBackfillOptions,
    rowLabel: string,
  ): Promise<Pick<StoredFile, 'id'>> {
    const existing = await this.prisma.storedFile.findUnique({
      where: { storage_ref: input.storageRef },
    });

    if (existing) {
      const patch: Prisma.StoredFileUncheckedUpdateInput = {};
      if (!existing.original_name && input.originalName) {
        patch.original_name = input.originalName;
      }
      if (!existing.mime_type && input.mimeType) {
        patch.mime_type = input.mimeType;
      }
      if (existing.size_bytes == null) {
        const inferredSize = await this.resolveFileSize(input.storageRef, input.sizeBytes);
        if (inferredSize != null) {
          patch.size_bytes = inferredSize;
        }
      }
      if (!existing.uploaded_by_user_id && input.uploadedByUserId) {
        patch.uploaded_by_user_id = input.uploadedByUserId;
      }

      if (
        existing.organization_id !== input.organizationId ||
        existing.owner_type !== input.ownerType ||
        existing.owner_id !== input.ownerId ||
        existing.kind !== input.kind ||
        existing.visibility !== input.visibility
      ) {
        this.logger.warn(
          `StoredFile existente con metadata distinta para ${rowLabel} y ref ${input.storageRef}. Se reutiliza id=${existing.id}.`,
        );
        this.bump(summary, sectionKey, 'warnings');
      }

      if (!options.dryRun && Object.keys(patch).length > 0) {
        await this.prisma.storedFile.update({
          where: { id: existing.id },
          data: patch,
        });
      }

      this.bump(summary, sectionKey, 'reused');
      return { id: existing.id };
    }

    const sizeBytes = await this.resolveFileSize(input.storageRef, input.sizeBytes);

    if (options.dryRun) {
      this.bump(summary, sectionKey, 'created');
      return { id: `dry-run:${input.ownerType}:${input.ownerId}` };
    }

    const created = await this.prisma.storedFile.create({
      data: {
        organization_id: input.organizationId,
        storage_ref: input.storageRef,
        original_name: input.originalName ?? null,
        mime_type: input.mimeType ?? null,
        size_bytes: sizeBytes,
        kind: input.kind,
        visibility: input.visibility,
        owner_type: input.ownerType,
        owner_id: input.ownerId,
        uploaded_by_user_id: input.uploadedByUserId ?? null,
      },
      select: { id: true },
    });

    this.bump(summary, sectionKey, 'created');
    return created;
  }

  private async resolveFileSize(storageRef: string, preferredSize?: number | null): Promise<number | null> {
    if (preferredSize != null) {
      return preferredSize;
    }

    if (!this.storageService.canHandleFileRef(storageRef)) {
      return null;
    }

    return this.storageService.getFileSize(storageRef);
  }

  private inferMimeType(storageRef: string): string | null {
    const fileName = this.extractOriginalName(storageRef).toLowerCase();
    const extension = path.extname(fileName);
    switch (extension) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.webp':
        return 'image/webp';
      case '.gif':
        return 'image/gif';
      case '.pdf':
        return 'application/pdf';
      default:
        return null;
    }
  }

  private extractOriginalName(storageRef: string): string {
    if (storageRef.startsWith('private://')) {
      const filePath = storageRef.slice('private://'.length);
      const slashIndex = filePath.indexOf('/');
      const normalizedPath = slashIndex === -1 ? filePath : filePath.slice(slashIndex + 1);
      return path.basename(normalizedPath);
    }

    try {
      const parsed = new URL(storageRef);
      return path.basename(parsed.pathname);
    } catch {
      return path.basename(storageRef);
    }
  }
}
