import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService
  ) {}

  private mapCompanyRelations<T extends Record<string, any>>(company: T): T & { company_users?: any[]; company_assets?: any[] } {
    return {
      ...company,
      company_users: company.users ?? undefined,
      company_assets: company.assets ?? undefined,
    };
  }

  private async resolveCompanyFileUrls<T extends Record<string, any>>(company: T) {
    const resolvedCompany = { ...company } as any;

    if (Array.isArray(resolvedCompany.assets)) {
      resolvedCompany.assets = await Promise.all(
        resolvedCompany.assets.map(async (asset: any) => ({
          ...asset,
          thumbnail_url: asset.thumbnail_url
            ? await this.storageService.resolveFileUrl(asset.thumbnail_url)
            : asset.thumbnail_url,
        }))
      );
    }

    return resolvedCompany;
  }

  async create(createCompanyDto: CreateCompanyDto, orgId: string) {
    const company = await this.prisma.company.create({
      data: {
        ...createCompanyDto,
        organization_id: orgId,
      },
    });
    return this.resolveCompanyFileUrls(this.mapCompanyRelations(company));
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
        this.prisma.company.findMany({
          where,
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        this.prisma.company.count({ where })
      ]);
      return {
        data: data.map((item: any) => this.mapCompanyRelations(item)),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
      };
    }

    const companies = await this.prisma.company.findMany({
      where,
      orderBy: { created_at: 'desc' }
    });
    return companies.map((item: any) => this.mapCompanyRelations(item));
  }

  async findOne(id: string, orgId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        users: { where: { is_active: true }, select: { id: true, name: true, email: true, role: true } },
        assets: { where: { is_active: true }, select: { id: true, name: true, category: true, thumbnail_url: true } }
      }
    });
    if (!company || company.organization_id !== orgId) {
      throw new NotFoundException('Company no encontrada');
    }
    return this.resolveCompanyFileUrls(this.mapCompanyRelations(company));
  }

  async update(id: string, updateCompanyDto: UpdateCompanyDto, orgId: string) {
    const existingCompany = await this.findOne(id, orgId);
    const company = await this.prisma.company.update({
      where: { id: existingCompany.id },
      data: updateCompanyDto,
    });
    return this.resolveCompanyFileUrls(this.mapCompanyRelations(company));
  }

  async remove(id: string, orgId: string) {
    const existingCompany = await this.findOne(id, orgId);
    const company = await this.prisma.company.update({
      where: { id: existingCompany.id },
      data: { is_active: false },
    });
    return this.resolveCompanyFileUrls(this.mapCompanyRelations(company));
  }
}
