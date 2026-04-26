import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { StorageService } from '../storage/storage.service';
import { StorageGovernanceService } from '../storage/storage-governance.service';
import * as crypto from 'crypto';
import { Role } from '@prisma/client';
import { ensureNoManualFileUrl, validateImageFile } from '../common/files/image-validation';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private storageGovernance: StorageGovernanceService,
  ) {}

  async findAll() {
    return this.prisma.organization.findMany({
      orderBy: { created_at: 'desc' }
    });
  }

  async findOne(id: string) {
    return this.prisma.organization.findUnique({
      where: { id }
    });
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
      select: { logo_url: true },
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
      await this.storageGovernance.assertCanStore(
        orgId,
        logoFile.size,
        currentOrg?.logo_url ? [currentOrg.logo_url] : [],
      );

      this.logger.log(`Uploading logo for organization ${orgId}...`);
      const logoUrl = await this.storage.uploadFile(logoFile, {
        folder: `${orgId}/branding`,
        visibility: 'public',
      });
      data.logo_url = logoUrl;
    }

    const updatedOrg = await this.prisma.organization.update({
      where: { id: orgId },
      data
    });

    if (logoFile && currentOrg?.logo_url && currentOrg.logo_url !== updatedOrg.logo_url) {
      await this.storage.deleteFile(currentOrg.logo_url);
    }

    return updatedOrg;
  }
}
