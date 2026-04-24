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
    // Extraer client_id y organization_id para que NO queden en assetData
    const { client_id, organization_id: dtoOrgId, ...assetData } = createAssetDto;
    
    console.log(`🚀 AssetsService.create - Procesando barco: ${assetData.name}, Cliente: ${client_id || 'Ninguno'}`);
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
        organization_id: targetOrgId
      },
    });

    // Si se especificó un cliente, crear el acceso automáticamente
    if (client_id) {
      await this.prisma.clientAssetAccess.create({
        data: {
          asset_id: newAsset.id,
          client_id: client_id,
        }
      });
    }

    // Devolver el activo con sus relaciones cargadas para que el frontend lo vea al instante
    return this.prisma.asset.findUnique({
      where: { id: newAsset.id },
      include: {
        organization: { select: { name: true } },
        client_access: {
          include: { client: { select: { name: true, id: true } } }
        }
      }
    });
  }

  async findAll(orgId: string, role: string, userId: string) {
    const include = {
      organization: { select: { name: true } },
      client_access: {
        include: { client: { select: { name: true, id: true } } }
      }
    };

    // Si es Super Admin, no filtrar por organización (ver todo)
    if (role === 'SUPER_ADMIN') {
      return this.prisma.asset.findMany({ include });
    }

    if (role === 'CLIENT') {
      return this.prisma.asset.findMany({
        where: {
          organization_id: orgId,
          is_active: true,
          client_access: { some: { client_id: userId } }
        },
        include
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
          include
        });
      }
    }

    return this.prisma.asset.findMany({
      where: { organization_id: orgId, is_active: true, },
      include
    });
  }

  async findOne(id: string, user: any) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        services: {
          include: { worker: { select: { name: true, id: true } } },
          orderBy: { created_at: 'desc' }
        },
        client_access: {
          include: { client: { select: { name: true, id: true, email: true } } }
        }
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
      const hasAccess = asset.client_access.some(ca => ca.client_id === user.id);
      if (!hasAccess) throw new NotFoundException('No tienes acceso a este activo');
      
      // Filtrar servicios privados para clientes
      asset.services = asset.services.filter(s => s.is_public);
    }

    return asset;
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

    const { client_id, ...updateData } = updateDto;
    let thumbnail_url = updateDto.thumbnail_url;

    if (photo) {
      thumbnail_url = await this.storageService.uploadFile(photo, `${asset.organization_id}/assets`);
    }

    const updatedAsset = await this.prisma.asset.update({
      where: { id: id },
      data: {
        ...updateData,
        thumbnail_url,
      }
    });

    // Actualizar cliente vinculado si se cambió
    // Actualizar cliente vinculado si se envió el campo (incluso si es vacío)
    if (client_id !== undefined) {
      // Eliminar accesos anteriores para este activo
      await this.prisma.clientAssetAccess.deleteMany({ where: { asset_id: id } });
      
      // Si el client_id no está vacío, crear el nuevo acceso
      if (client_id && client_id !== "") {
        await this.prisma.clientAssetAccess.create({
          data: {
            asset_id: id,
            client_id: client_id,
          }
        });
      }
    }

    return updatedAsset;
  }
}
