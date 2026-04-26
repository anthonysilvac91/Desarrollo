import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  private mapCompanyRelations<T extends Record<string, any>>(customer: T): T & { company_users?: any[]; company_assets?: any[] } {
    return {
      ...customer,
      company_users: customer.users ?? undefined,
      company_assets: customer.assets ?? undefined,
    };
  }

  async create(createCustomerDto: CreateCustomerDto, orgId: string) {
    const customer = await this.prisma.customer.create({
      data: {
        ...createCustomerDto,
        organization_id: orgId,
      },
    });
    return this.mapCompanyRelations(customer);
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
      return {
        data: data.map((item: any) => this.mapCompanyRelations(item)),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
      };
    }

    const customers = await this.prisma.customer.findMany({
      where,
      orderBy: { created_at: 'desc' }
    });
    return customers.map((item: any) => this.mapCompanyRelations(item));
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
      throw new NotFoundException('Company no encontrada');
    }
    return this.mapCompanyRelations(customer);
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto, orgId: string) {
    const existingCustomer = await this.findOne(id, orgId);
    const customer = await this.prisma.customer.update({
      where: { id: existingCustomer.id },
      data: updateCustomerDto,
    });
    return this.mapCompanyRelations(customer);
  }

  async remove(id: string, orgId: string) {
    const existingCustomer = await this.findOne(id, orgId);
    const customer = await this.prisma.customer.update({
      where: { id: existingCustomer.id },
      data: { is_active: false },
    });
    return this.mapCompanyRelations(customer);
  }
}
