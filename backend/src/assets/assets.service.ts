import { StorageService } from '../storage/storage.service';

@Injectable()
export class AssetsService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService
  ) {}

  async create(createAssetDto: CreateAssetDto, orgId: string, photo?: Express.Multer.File) {
    let thumbnail_url = createAssetDto.thumbnail_url;

    if (photo) {
      thumbnail_url = await this.storageService.uploadFile(photo, `${orgId}/assets`);
    }

    return this.prisma.asset.create({
      data: {
        ...createAssetDto,
        thumbnail_url,
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

    if (!asset || asset.organization_id !== user.orgId) {
      throw new NotFoundException('Activo no encontrado');
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
}
