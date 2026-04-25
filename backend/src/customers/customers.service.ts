import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async create(createCustomerDto: CreateCustomerDto, orgId: string) {
    return this.prisma.customer.create({
      data: {
        ...createCustomerDto,
        organization_id: orgId,
      },
    });
  }

  async findAll(orgId: string, query?: PaginationQueryDto) {
    const where: any = { organization_id: orgId, is_active: true };
    
    if (query?.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    if (query?.page && query?.limit) {
      const page = Number(query.page);
      const limit = Number(query.limit);
      const [data, total] = await Promise.all([
        this.prisma.customer.findMany({
          where,
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        this.prisma.customer.count({ where })
      ]);
      return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }

    return this.prisma.customer.findMany({
      where,
      orderBy: { created_at: 'desc' }
    });
  }

  async findOne(id: string, orgId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        users: { where: { is_active: true }, select: { id: true, name: true, email: true, role: true } },
        assets: { where: { is_active: true }, select: { id: true, name: true, category: true, thumbnail_url: true } }
      }
    });
    if (!customer || customer.organization_id !== orgId) {
      throw new NotFoundException('Cliente no encontrado');
    }
    return customer;
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto, orgId: string) {
    const customer = await this.findOne(id, orgId);
    return this.prisma.customer.update({
      where: { id: customer.id },
      data: updateCustomerDto,
    });
  }

  async remove(id: string, orgId: string) {
    const customer = await this.findOne(id, orgId);
    return this.prisma.customer.update({
      where: { id: customer.id },
      data: { is_active: false },
    });
  }
}
