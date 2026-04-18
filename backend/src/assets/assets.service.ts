import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

  async create(createAssetDto: CreateAssetDto, orgId: string) {
    return this.prisma.asset.create({
      data: {
        ...createAssetDto,
        organization_id: orgId,
      },
    });
  }

  async findAll(orgId: string, role: string, userId: string) {
    if (role === 'CLIENT') {
      return this.prisma.asset.findMany({
        where: {
          organization_id: orgId,
          is_active: true,
          client_access: { some: { client_id: userId } }
        },
      });
    }

    if (role === 'WORKER') {
      const org = await this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { worker_restricted_access: true },
      });

      if (org?.worker_restricted_access) {
        return this.prisma.asset.findMany({
          where: {
            organization_id: orgId,
            is_active: true,
            worker_access: { some: { worker_id: userId } }
          },
        });
      }
    }

    return this.prisma.asset.findMany({
      where: { organization_id: orgId, is_active: true, },
    });
  }

  async assignClient(assetId: string, clientId: string, orgId: string, adminId: string) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, organization_id: orgId }});
    const client = await this.prisma.user.findFirst({ where: { id: clientId, role: 'CLIENT', organization_id: orgId }});
    
    if (!asset || !client) throw new NotFoundException('Activo o Cliente no existe en su organización');

    return this.prisma.clientAssetAccess.create({
      data: { asset_id: assetId, client_id: clientId, granted_by_id: adminId }
    });
  }

  async removeClient(assetId: string, clientId: string, orgId: string) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, organization_id: orgId }});
    if (!asset) throw new NotFoundException('Activo no encontrado');

    return this.prisma.clientAssetAccess.delete({
      where: {
        client_id_asset_id: { asset_id: assetId, client_id: clientId }
      }
    });
  }
}
