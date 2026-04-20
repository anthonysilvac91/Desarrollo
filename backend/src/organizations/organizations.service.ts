import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { StorageService } from '../storage/storage.service';
import * as crypto from 'crypto';
import { Role } from '@prisma/client';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService
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

    if (logoFile) {
      this.logger.log(`Uploading logo for organization ${orgId}...`);
      const logoUrl = await this.storage.uploadFile(logoFile, `${orgId}/branding`);
      data.logo_url = logoUrl;
    }

    return this.prisma.organization.update({
      where: { id: orgId },
      data
    });
  }
}
