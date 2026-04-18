import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ListServicesQueryDto } from './dto/list-services-query.dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async create(createServiceDto: CreateServiceDto, user: any, files?: Express.Multer.File[]) {
    const org = await this.prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { auto_publish_services: true }
    });
    if (!org) throw new NotFoundException('Organization not found');

    const attachments = files?.map(file => ({
      file_url: `/uploads/${file.filename}`,
      file_type: file.mimetype,
    })) || [];

    return this.prisma.service.create({
      data: {
        ...createServiceDto,
        organization_id: user.orgId,
        worker_id: user.id,
        is_public: org.auto_publish_services,
        status: 'COMPLETED',
        attachments: {
          create: attachments,
        }
      },
      include: { attachments: true }
    });
  }

  async findAll(query: ListServicesQueryDto, user: any) {
    const whereClause: any = { organization_id: user.orgId };
    if (query.asset_id) whereClause.asset_id = query.asset_id;

    if (user.role === 'CLIENT') {
      whereClause.is_public = true;
      whereClause.status = 'COMPLETED';
    }

    return this.prisma.service.findMany({
      where: whereClause,
      include: { worker: { select: { id: true, name: true } } },
      orderBy: { created_at: 'desc' }
    });
  }

  async update(id: string, updateServiceDto: UpdateServiceDto, orgId: string) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service || service.organization_id !== orgId) {
      throw new NotFoundException('Service no encontrado o no pertenece a tu Organización');
    }

    return this.prisma.service.update({
      where: { id },
      data: {
        ...updateServiceDto,
        admin_intervened: true
      }
    });
  }
}
