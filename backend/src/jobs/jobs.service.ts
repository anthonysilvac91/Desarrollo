import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto';

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  async create(createJobDto: CreateJobDto, user: any) {
    const org = await this.prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { auto_publish_jobs: true }
    });
    if (!org) throw new NotFoundException('Organization not found');

    return this.prisma.job.create({
      data: {
        ...createJobDto,
        organization_id: user.orgId,
        worker_id: user.id,
        is_public: org.auto_publish_jobs,
        status: 'COMPLETED',
      },
    });
  }

  async findAll(query: ListJobsQueryDto, user: any) {
    const whereClause: any = { organization_id: user.orgId };
    if (query.asset_id) whereClause.asset_id = query.asset_id;

    if (user.role === 'CLIENT') {
      whereClause.is_public = true;
      whereClause.status = 'COMPLETED';
    }

    return this.prisma.job.findMany({
      where: whereClause,
      include: { worker: { select: { id: true, name: true } } },
      orderBy: { created_at: 'desc' }
    });
  }

  async update(id: string, updateJobDto: UpdateJobDto, orgId: string) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job || job.organization_id !== orgId) {
      throw new NotFoundException('Job no encontrado o no pertenece a tu Organización');
    }

    return this.prisma.job.update({
      where: { id },
      data: {
        ...updateJobDto,
        admin_intervened: true
      }
    });
  }
}
