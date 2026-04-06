import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async updateSettings(orgId: string, dto: UpdateOrganizationSettingsDto) {
    return this.prisma.organization.update({
      where: { id: orgId },
      data: dto
    });
  }
}
