import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { StorageService } from '../storage/storage.service';
import { StorageGovernanceService } from '../storage/storage-governance.service';
import { StoredFilesService } from '../storage/stored-files.service';
import { StoredFileKind } from '@prisma/client';
import {
  ensureNoManualFileUrl,
  validateImageFile,
} from '../common/files/image-validation';
import { processUploadedImage } from '../common/files/image-processing';
import { buildOrganizationLogoPath } from '../common/files/storage-paths';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PLAN_LIMITS } from '../subscriptions/plan-limits';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private storageGovernance: StorageGovernanceService,
    private storedFilesService: StoredFilesService,
    private subscriptionsService: SubscriptionsService,
  ) {}

  async findAll() {
    const organizations = await this.prisma.organization.findMany({
      orderBy: { created_at: 'desc' },
    });

    return Promise.all(
      organizations.map(async (organization: any) => {
        organization.logo_url =
          await this.storedFilesService.resolveFileUrlForOrg(
            organization.logo_file_id,
            organization.id,
          );

        return organization;
      }),
    );
  }

  async findOne(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      return organization;
    }

    (organization as any).logo_url =
      await this.storedFilesService.resolveFileUrlForOrg(
        organization.logo_file_id,
        organization.id,
      );

    return organization;
  }

  async getStorageUsage(orgId: string) {
    return this.storageGovernance.getOrganizationUsage(orgId);
  }

  async reconcileStorage(orgId: string, deleteOrphans = false) {
    return this.storageGovernance.reconcileOrganizationFiles(
      orgId,
      deleteOrphans,
    );
  }

  private buildSlug(name: string): string {
    const base = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 36);
    const suffix = Math.random().toString(36).substring(2, 8);
    return `${base}-${suffix}`;
  }

  async create(dto: CreateOrganizationDto) {
    const slug = this.buildSlug(dto.name);
    const limits = PLAN_LIMITS.DEMO;

    const org = await this.prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: { name: dto.name, slug },
      });

      await tx.subscription.create({
        data: {
          organization_id: created.id,
          plan: 'DEMO',
          status: 'TRIALING',
          max_users: limits.max_users,
          max_assets: limits.max_assets,
          max_storage_gb: limits.max_storage_gb,
          max_video_hours: limits.max_video_hours,
          allow_external: limits.allow_external,
          allow_branding: limits.allow_branding,
          allow_ai_translation: limits.allow_ai_translation,
          demo_expires_at: new Date(
            Date.now() + limits.demo_duration_days! * 24 * 60 * 60 * 1000,
          ),
        },
      });

      await tx.organizationStorageUsage.create({
        data: {
          organization_id: created.id,
          ready_bytes: 0,
          reserved_bytes: 0,
          ready_file_count: 0,
          pending_upload_count: 0,
        },
      });

      return created;
    });

    this.logger.log(`Organization created: ${org.name}`);
    return { organization: org };
  }

  async toggleStatus(id: string, is_active: boolean) {
    return this.prisma.organization.update({
      where: { id },
      data: { is_active },
    });
  }

  async updateSettings(
    orgId: string,
    dto: UpdateOrganizationSettingsDto,
    logoFile?: Express.Multer.File,
  ) {
    const data: any = { ...dto };
    const currentOrg = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { logo_file_id: true },
    });

    ensureNoManualFileUrl(dto.logo_url, 'Logo de organizacion');
    delete data.logo_url;

    if (typeof data.show_org_name === 'string') {
      data.show_org_name = data.show_org_name === 'true';
    }

    if (logoFile) {
      const imageInfo = validateImageFile(logoFile, {
        maxBytes: 2 * 1024 * 1024,
        label: 'Logo de organizacion',
        maxWidth: 4096,
        maxHeight: 4096,
        maxPixels: 12 * 1024 * 1024,
      });
      logoFile.mimetype = imageInfo.mime;
      await processUploadedImage(logoFile, {
        maxWidth: 1200,
        maxHeight: 1200,
        format: 'webp',
        quality: 88,
      });
      await this.storageGovernance.assertCanStore(
        orgId,
        logoFile.size,
        currentOrg?.logo_file_id ? [currentOrg.logo_file_id] : [],
      );

      this.logger.log(`Uploading logo for organization ${orgId}...`);
      const logoUrl = await this.storage.uploadFile(logoFile, {
        folder: buildOrganizationLogoPath(orgId),
        visibility: 'public',
      });
      const storedFile = await this.storedFilesService.registerUploadedFile({
        organizationId: orgId,
        storageRef: logoUrl,
        originalName: logoFile.originalname,
        mimeType: logoFile.mimetype,
        sizeBytes: logoFile.size,
        kind: StoredFileKind.ORG_LOGO,
        visibility: 'public',
        entityType: 'ORGANIZATION',
        entityId: orgId,
      });
      data.logo_file_id = storedFile.id;
    }

    let updatedOrg;
    try {
      updatedOrg = await this.prisma.organization.update({
        where: { id: orgId },
        data,
      });
    } catch (error) {
      if (logoFile && data.logo_file_id) {
        await this.storedFilesService.deleteStoredFileAndBlob(
          data.logo_file_id,
        );
      }
      throw error;
    }

    if (logoFile && currentOrg?.logo_file_id) {
      await this.storedFilesService.deleteStoredFileAndBlob(
        currentOrg.logo_file_id,
      );
    }

    updatedOrg.logo_url = await this.storedFilesService.resolveFileUrlForOrg(
      updatedOrg.logo_file_id,
      updatedOrg.id,
    );

    return updatedOrg;
  }
}
