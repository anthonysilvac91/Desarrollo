import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { StorageService } from '../storage/storage.service';
import { StorageGovernanceService } from '../storage/storage-governance.service';
import { StoredFilesService } from '../storage/stored-files.service';
import * as crypto from 'crypto';
import { Role, StoredFileKind } from '@prisma/client';
import { ensureNoManualFileUrl, validateImageFile } from '../common/files/image-validation';
import { processUploadedImage } from '../common/files/image-processing';
import { buildOrganizationLogoPath } from '../common/files/storage-paths';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private storageGovernance: StorageGovernanceService,
    private storedFilesService: StoredFilesService,
  ) {}

  async findAll() {
    const organizations = await this.prisma.organization.findMany({
      orderBy: { created_at: 'desc' }
    });

    return Promise.all(
      organizations.map(async (organization: any) => {
        organization.logo_url = organization.logo_file_id
          ? await this.storedFilesService.resolveFileUrl(organization.logo_file_id)
          : null;

        return organization;
      }),
    );
  }

  async findOne(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id }
    });

    if (!organization) {
      return organization;
    }

    organization.logo_url = organization.logo_file_id
      ? await this.storedFilesService.resolveFileUrl(organization.logo_file_id)
      : null;

    return organization;
  }

  async getStorageUsage(orgId: string) {
    return this.storageGovernance.getOrganizationUsage(orgId);
  }

  async reconcileStorage(orgId: string, deleteOrphans = false) {
    return this.storageGovernance.reconcileOrganizationFiles(orgId, deleteOrphans);
  }

  async create(dto: CreateOrganizationDto, superAdminId: string) {
    const existingOrg = await this.prisma.organization.findUnique({ where: { slug: dto.slug } });
    if (existingOrg) throw new ConflictException('El slug de organización ya existe');

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: dto.name,
          slug: dto.slug,
        }
      });

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await tx.invitation.create({
        data: {
          organization_id: org.id,
          email: dto.admin_email,
          role: Role.ADMIN,
          token: token,
          invited_by_id: superAdminId,
          expires_at: expiresAt,
        }
      });

      this.logger.log(`Organization created: [${org.slug}] ${org.name} - Initial Admin Email: ${dto.admin_email}`);
      return { organization: org, initial_invitation_token: invitation.token };
    });
  }

  async toggleStatus(id: string, is_active: boolean) {
    return this.prisma.organization.update({
      where: { id },
      data: { is_active }
    });
  }

  async updateSettings(orgId: string, dto: UpdateOrganizationSettingsDto, logoFile?: Express.Multer.File) {
    const data: any = { ...dto };
    const currentOrg = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { logo_url: true, logo_file_id: true },
    });

    ensureNoManualFileUrl(dto.logo_url, 'Logo de organizacion');
    delete data.logo_url;

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
      const storedFile = await this.storedFilesService.registerFile({
        organizationId: orgId,
        storageRef: logoUrl,
        originalName: logoFile.originalname,
        mimeType: logoFile.mimetype,
        sizeBytes: logoFile.size,
        kind: StoredFileKind.ORG_LOGO,
        visibility: 'public',
        ownerType: 'ORGANIZATION',
        ownerId: orgId,
      });
      data.logo_file_id = storedFile.id;
    }

    const updatedOrg = await this.prisma.organization.update({
      where: { id: orgId },
      data
    });

    if (logoFile && currentOrg?.logo_file_id) {
      await this.storedFilesService.deleteStoredFileAndBlob(
        currentOrg.logo_file_id,
      );
    }

    updatedOrg.logo_url = updatedOrg.logo_file_id
      ? await this.storedFilesService.resolveFileUrl(updatedOrg.logo_file_id)
      : null;

    return updatedOrg;
  }
}
