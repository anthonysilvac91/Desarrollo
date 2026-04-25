import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { StorageService } from '../storage/storage.service';
@Injectable()
export class AssetsService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService
  ) {}

  async create(createAssetDto: CreateAssetDto, orgId: string, photo?: Express.Multer.File) {
    const { customer_id, organization_id: dtoOrgId, ...assetData } = createAssetDto;
    
    console.log(`🚀 AssetsService.create - Procesando barco: ${assetData.name}, Cliente: ${customer_id || 'Ninguno'}`);
    let thumbnail_url = createAssetDto.thumbnail_url;

    if (photo) {
      thumbnail_url = await this.storageService.uploadFile(photo, `${orgId}/assets`);
    }

    const targetOrgId = orgId || dtoOrgId;
    if (!targetOrgId) {
      throw new Error('Es necesario especificar una organización para el activo');
    }

    const newAsset = await this.prisma.asset.create({
      data: {
        ...assetData,
        thumbnail_url,
        organization_id: targetOrgId,
        customer_id: customer_id || null,
      },
    });

    // Devolver el activo con sus relaciones cargadas para que el frontend lo vea al instante
    return this.prisma.asset.findUnique({
      where: { id: newAsset.id },
      include: {
        organization: { select: { name: true } },
        customer: { select: { id: true, name: true } }
      }
    });
  }

  async findAll(query: any, orgId: string, role: string, userId: string) {
    const include = {
      organization: { select: { name: true } },
      customer: { select: { id: true, name: true } }
    };

    const baseWhere: any = { is_active: true };

    if (role !== 'SUPER_ADMIN') {
      baseWhere.organization_id = orgId;
    }

    if (role === 'CLIENT') {
      baseWhere.customer_id = userId; // In MVP, userId will be verified through their customer_id
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
        { location: { contains: query.search, mode: 'insensitive' } }
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
          take: limit
        }),
        this.prisma.asset.count({ where: baseWhere })
      ]);
      return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }

    return this.prisma.asset.findMany({ where: baseWhere, include });
  }

  async findOne(id: string, user: any) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        services: {
          include: { worker: { select: { name: true, id: true } } },
          orderBy: { created_at: 'desc' }
        },
        customer: { select: { id: true, name: true } }
      }
    });

    if (!asset) {
      throw new NotFoundException('Activo no encontrado');
    }

    // Si no es Super Admin, verificar que el activo pertenezca a su organización
    if (user.role !== 'SUPER_ADMIN' && asset.organization_id !== user.orgId) {
      throw new NotFoundException('Activo no encontrado o sin acceso');
    }

    if (user.role === 'CLIENT') {
      // Assuming user.customer_id will be available
      if (asset.customer_id !== user.customer_id) throw new NotFoundException('No tienes acceso a este activo');
      
      // Filtrar servicios privados para clientes
      asset.services = asset.services.filter(s => s.is_public);
    }

    return asset;
  }

  async assignClient(assetId: string, customerId: string, orgId: string, adminId: string) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, organization_id: orgId }});
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, organization_id: orgId }});
    
    if (!asset || !customer) throw new NotFoundException('Activo o Empresa no existe en su organización');

    return this.prisma.asset.update({
      where: { id: assetId },
      data: { customer_id: customerId }
    });
  }

  async removeClient(assetId: string, customerId: string, orgId: string) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, organization_id: orgId }});
    if (!asset) throw new NotFoundException('Activo no encontrado');

    return this.prisma.asset.update({
      where: { id: assetId },
      data: { customer_id: null }
    });
  }

  async remove(id: string, user: any) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Activo no encontrado');

    // Seguridad: Si no es Super Admin, debe pertenecer a su organización
    if (user.role !== 'SUPER_ADMIN' && asset.organization_id !== user.orgId) {
      throw new ForbiddenException('No tienes permiso para borrar este activo');
    }

    return this.prisma.asset.update({
      where: { id },
      data: { is_active: false }
    });
  }

  async update(id: string, updateDto: any, orgId: string, role: string, photo?: Express.Multer.File) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Activo no encontrado');

    // Seguridad: Si no es Super Admin, debe pertenecer a su organización
    if (role !== 'SUPER_ADMIN' && asset.organization_id !== orgId) {
      throw new ForbiddenException('No tienes permiso para editar este activo');
    }

    const { customer_id, ...updateData } = updateDto;
    let thumbnail_url = updateDto.thumbnail_url;

    if (photo) {
      thumbnail_url = await this.storageService.uploadFile(photo, `${asset.organization_id}/assets`);
    }

    const updatePayload: any = {
      ...updateData,
      thumbnail_url,
    };

    if (customer_id !== undefined) {
      updatePayload.customer_id = customer_id || null;
    }

    const updatedAsset = await this.prisma.asset.update({
      where: { id: id },
      data: updatePayload
    });

    return updatedAsset;
  }
}
