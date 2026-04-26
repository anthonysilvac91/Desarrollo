import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateAssetDto } from './dto/create-asset.dto';

@Injectable()
export class AssetsService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService
  ) {}

  private mapAssetRelations<T extends Record<string, any>>(asset: T): T & { company_id: string | null; company: any; customer_id: string | null; customer: any } {
    return {
      ...asset,
      company_id: asset.company_id ?? asset.customer_id ?? null,
      company: asset.company ?? asset.customer ?? null,
      customer_id: asset.company_id ?? asset.customer_id ?? null,
      customer: asset.company ?? asset.customer ?? null,
    };
  }

  private async ensureCompanyBelongsToOrg(companyId: string, orgId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, organization_id: orgId, is_active: true },
      select: { id: true },
    });

    if (!company) {
      throw new BadRequestException('La company indicada no pertenece a tu organización');
    }
  }

  async create(createAssetDto: CreateAssetDto, orgId: string, photo?: Express.Multer.File) {
    const { company_id: companyId, organization_id: dtoOrgId, ...assetData } = createAssetDto;
    let thumbnail_url = createAssetDto.thumbnail_url;

    if (photo) {
      thumbnail_url = await this.storageService.uploadFile(photo, `${orgId}/assets`);
    }

    const targetOrgId = orgId || dtoOrgId;
    if (!targetOrgId) {
      throw new Error('Es necesario especificar una organización para el activo');
    }

    if (companyId) {
      await this.ensureCompanyBelongsToOrg(companyId, targetOrgId);
    }

    const newAsset = await this.prisma.asset.create({
      data: {
        ...assetData,
        thumbnail_url,
        organization_id: targetOrgId,
        company_id: companyId || null,
      },
    });

    const asset = await this.prisma.asset.findUnique({
      where: { id: newAsset.id },
      include: {
        organization: { select: { name: true } },
        company: { select: { id: true, name: true } },
      },
    });

    return asset ? this.mapAssetRelations(asset) : asset;
  }

  async findAll(query: any, orgId: string, role: string, userId: string, companyId?: string) {
    const include = {
      organization: { select: { name: true } },
      company: { select: { id: true, name: true } },
      _count: { select: { services: true } },
      services: {
        select: { created_at: true },
        orderBy: { created_at: 'desc' as const },
        take: 1,
      },
    };

    const baseWhere: any = { is_active: true };

    if (role !== 'SUPER_ADMIN') {
      baseWhere.organization_id = orgId;
    }

    if (role === 'CLIENT') {
      if (!companyId) {
        return [];
      }
      baseWhere.company_id = companyId;
    }

    if (role === 'WORKER') {
      const org = await this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { worker_restricted_access: true },
      });
      if (org?.worker_restricted_access) {
        baseWhere.worker_access = { some: { worker_id: userId } };
      }
    }

    if (query.search) {
      baseWhere.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { location: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.page && query.limit) {
      const page = Number(query.page);
      const limit = Number(query.limit);
      const [data, total] = await Promise.all([
        this.prisma.asset.findMany({
          where: baseWhere,
          include,
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.asset.count({ where: baseWhere }),
      ]);
      return {
        data: data.map((asset: any) => this.mapAssetRelations({
          ...asset,
          last_service: asset.services[0] ? { date: asset.services[0].created_at } : null,
        })),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }

    const assets = await this.prisma.asset.findMany({ where: baseWhere, include });
    return assets.map((asset: any) => this.mapAssetRelations({
      ...asset,
      last_service: asset.services[0] ? { date: asset.services[0].created_at } : null,
    }));
  }

  async findOne(id: string, user: any) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        services: {
          include: {
            worker: { select: { name: true, id: true } },
            attachments: { select: { id: true, file_url: true, file_type: true } },
          },
          orderBy: { created_at: 'desc' },
        },
        company: { select: { id: true, name: true } },
      },
    });

    if (!asset) {
      throw new NotFoundException('Activo no encontrado');
    }

    if (user.role !== 'SUPER_ADMIN' && asset.organization_id !== user.orgId) {
      throw new NotFoundException('Activo no encontrado o sin acceso');
    }

    if (user.role === 'WORKER') {
      const org = await this.prisma.organization.findUnique({
        where: { id: asset.organization_id },
        select: { worker_restricted_access: true },
      });

      if (org?.worker_restricted_access) {
        const hasAccess = await this.prisma.workerAssetAccess.findUnique({
          where: {
            worker_id_asset_id: {
              worker_id: user.id,
              asset_id: asset.id,
            },
          },
          select: { worker_id: true },
        });

        if (!hasAccess) {
          throw new NotFoundException('Activo no encontrado o sin acceso');
        }
      }
    }

    if (user.role === 'CLIENT') {
      const currentCompanyId = user.company_id ?? user.customer_id;
      if (asset.company_id !== currentCompanyId) throw new NotFoundException('No tienes acceso a este activo');
      asset.services = asset.services.filter(s => s.is_public);
    }

    return this.mapAssetRelations(asset);
  }

  async assignCompany(assetId: string, companyId: string, orgId: string) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, organization_id: orgId } });
    const company = await this.prisma.company.findFirst({ where: { id: companyId, organization_id: orgId } });

    if (!asset || !company) throw new NotFoundException('Activo o company no existe en su organización');

    const updatedAsset = await this.prisma.asset.update({
      where: { id: assetId },
      data: { company_id: companyId },
    });
    return this.mapAssetRelations(updatedAsset);
  }

  async removeCompany(assetId: string, companyId: string, orgId: string) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, organization_id: orgId } });
    if (!asset) throw new NotFoundException('Activo no encontrado');

    const updatedAsset = await this.prisma.asset.update({
      where: { id: assetId },
      data: { company_id: null },
    });
    return this.mapAssetRelations(updatedAsset);
  }

  async remove(id: string, user: any) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Activo no encontrado');

    if (user.role !== 'SUPER_ADMIN' && asset.organization_id !== user.orgId) {
      throw new ForbiddenException('No tienes permiso para borrar este activo');
    }

    return this.prisma.asset.update({
      where: { id },
      data: { is_active: false },
    });
  }

  async update(id: string, updateDto: any, orgId: string, role: string, photo?: Express.Multer.File) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Activo no encontrado');

    if (role !== 'SUPER_ADMIN' && asset.organization_id !== orgId) {
      throw new ForbiddenException('No tienes permiso para editar este activo');
    }

    const { company_id: companyId, ...updateData } = updateDto;
    let thumbnail_url = updateDto.thumbnail_url;

    if (photo) {
      thumbnail_url = await this.storageService.uploadFile(photo, `${asset.organization_id}/assets`);
    }

    const updatePayload: any = {
      ...updateData,
      thumbnail_url,
    };

    if (companyId !== undefined) {
      if (companyId) {
        await this.ensureCompanyBelongsToOrg(companyId, asset.organization_id);
      }
      updatePayload.company_id = companyId || null;
    }

    const updatedAsset = await this.prisma.asset.update({
      where: { id },
      data: updatePayload,
    });

    return this.mapAssetRelations(updatedAsset);
  }
}
