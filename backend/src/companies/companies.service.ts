import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { StorageService } from '../storage/storage.service';
import { StorageGovernanceService } from '../storage/storage-governance.service';
import { StoredFilesService } from '../storage/stored-files.service';
import { ensureNoManualFileUrl, validateImageFile } from '../common/files/image-validation';
import { processUploadedImage } from '../common/files/image-processing';
import { buildCompanyLogoPath } from '../common/files/storage-paths';
import { randomUUID } from 'crypto';
import { StoredFileKind } from '@prisma/client';

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private storageGovernance: StorageGovernanceService,
    private storedFilesService: StoredFilesService,
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
          thumbnail_url: await this.storedFilesService.resolveFileUrlOrRef(
            asset.thumbnail_file_id,
            asset.thumbnail_url,
          ),
        }))
      );
    }

    resolvedCompany.logo_url = await this.storedFilesService.resolveFileUrlOrRef(
      resolvedCompany.logo_file_id,
      resolvedCompany.logo_url,
    );

    return resolvedCompany;
  }

  async create(createCompanyDto: CreateCompanyDto, orgId: string, logoFile?: Express.Multer.File) {
    ensureNoManualFileUrl(createCompanyDto.logo_url, 'Logo de company');
    const { logo_url: _logoUrl, ...companyData } = createCompanyDto;

    const companyId = randomUUID();
    let logoUrl: string | undefined;
    if (logoFile) {
      const imageInfo = validateImageFile(logoFile, {
        maxBytes: 2 * 1024 * 1024,
        label: 'Logo de company',
        maxWidth: 4096,
        maxHeight: 4096,
        maxPixels: 12 * 1024 * 1024,
      });
      logoFile.mimetype = imageInfo.mime;
      await processUploadedImage(logoFile, {
        maxWidth: 1200,
        maxHeight: 1200,
        format: 'webp',
        quality: 88,
      });
      await this.storageGovernance.assertCanStore(orgId, logoFile.size);
      logoUrl = await this.storageService.uploadFile(logoFile, {
        folder: buildCompanyLogoPath(orgId, companyId),
        visibility: 'private',
      });
    }

    let logoFileId: string | null = null;
    if (logoFile && logoUrl) {
      const storedFile = await this.storedFilesService.registerUploadedFile({
        organizationId: orgId,
        storageRef: logoUrl,
        originalName: logoFile.originalname,
        mimeType: logoFile.mimetype,
        sizeBytes: logoFile.size,
        kind: StoredFileKind.COMPANY_LOGO,
        visibility: 'private',
        ownerType: 'COMPANY',
        ownerId: companyId,
      });
      logoFileId = storedFile.id;
    }

    let company;
    try {
      company = await this.prisma.company.create({
        data: {
          id: companyId,
          ...companyData,
          logo_file_id: logoFileId,
          organization_id: orgId,
        },
      });
    } catch (error) {
      if (logoFileId) {
        await this.storedFilesService.deleteStoredFileAndBlob(logoFileId);
      }
      throw error;
    }
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
        data: await Promise.all(data.map((item: any) => this.resolveCompanyFileUrls(this.mapCompanyRelations(item)))),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
      };
    }

    const companies = await this.prisma.company.findMany({
      where,
      orderBy: { created_at: 'desc' }
    });
    return Promise.all(companies.map((item: any) => this.resolveCompanyFileUrls(this.mapCompanyRelations(item))));
  }

  async findOne(id: string, orgId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        users: { where: { is_active: true }, select: { id: true, name: true, email: true, role: true } },
        assets: { where: { is_active: true }, select: { id: true, name: true, category: true, thumbnail_url: true, thumbnail_file_id: true } }
      }
    });
    if (!company || company.organization_id !== orgId) {
      throw new NotFoundException('Company no encontrada');
    }
    return this.resolveCompanyFileUrls(this.mapCompanyRelations(company));
  }

  async update(id: string, updateCompanyDto: UpdateCompanyDto, orgId: string, logoFile?: Express.Multer.File) {
    const existingCompany = await this.prisma.company.findUnique({
      where: { id },
      select: { id: true, organization_id: true, logo_url: true, logo_file_id: true },
    });

    if (!existingCompany || existingCompany.organization_id !== orgId) {
      throw new NotFoundException('Company no encontrada');
    }

    ensureNoManualFileUrl(updateCompanyDto.logo_url, 'Logo de company');
    const { logo_url: _logoUrl, ...companyData } = updateCompanyDto;

    let logoUrl: string | undefined;
    if (logoFile) {
      const imageInfo = validateImageFile(logoFile, {
        maxBytes: 2 * 1024 * 1024,
        label: 'Logo de company',
        maxWidth: 4096,
        maxHeight: 4096,
        maxPixels: 12 * 1024 * 1024,
      });
      logoFile.mimetype = imageInfo.mime;
      await processUploadedImage(logoFile, {
        maxWidth: 1200,
        maxHeight: 1200,
        format: 'webp',
        quality: 88,
      });
      await this.storageGovernance.assertCanStore(
        orgId,
        logoFile.size,
        existingCompany.logo_file_id ? [existingCompany.logo_file_id] : [],
      );
      logoUrl = await this.storageService.uploadFile(logoFile, {
        folder: buildCompanyLogoPath(orgId, existingCompany.id),
        visibility: 'private',
      });
    }

    let logoFileId = existingCompany.logo_file_id;
    if (logoFile && logoUrl) {
      const storedFile = await this.storedFilesService.registerUploadedFile({
        organizationId: orgId,
        storageRef: logoUrl,
        originalName: logoFile.originalname,
        mimeType: logoFile.mimetype,
        sizeBytes: logoFile.size,
        kind: StoredFileKind.COMPANY_LOGO,
        visibility: 'private',
        ownerType: 'COMPANY',
        ownerId: existingCompany.id,
      });
      logoFileId = storedFile.id;
    }

    let company;
    try {
      company = await this.prisma.company.update({
        where: { id: existingCompany.id },
        data: {
          ...companyData,
          logo_file_id: logoFileId,
        },
      });
    } catch (error) {
      if (logoFile && logoFileId && logoFileId !== existingCompany.logo_file_id) {
        await this.storedFilesService.deleteStoredFileAndBlob(logoFileId);
      }
      throw error;
    }

    if (logoFile && existingCompany.logo_file_id) {
      await this.storedFilesService.deleteStoredFileAndBlob(
        existingCompany.logo_file_id,
      );
    }

    return this.resolveCompanyFileUrls(this.mapCompanyRelations(company));
  }

  async remove(id: string, orgId: string) {
    const existingCompany = await this.prisma.company.findUnique({
      where: { id },
      select: { id: true, organization_id: true, logo_url: true, logo_file_id: true },
    });

    if (!existingCompany || existingCompany.organization_id !== orgId) {
      throw new NotFoundException('Company no encontrada');
    }

    const company = await this.prisma.company.update({
      where: { id: existingCompany.id },
      data: { is_active: false, logo_file_id: null },
    });

    if (existingCompany.logo_file_id) {
      await this.storedFilesService.deleteStoredFileAndBlob(
        existingCompany.logo_file_id,
      );
    }

    return this.resolveCompanyFileUrls(this.mapCompanyRelations(company));
  }
}
