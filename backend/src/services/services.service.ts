import { Injectable, NotFoundException, ForbiddenException, Logger, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import { ServiceStatsQueryDto } from './dto/service-stats-query.dto';
import { StorageService } from '../storage/storage.service';
import { StorageGovernanceService } from '../storage/storage-governance.service';
import { StoredFilesService } from '../storage/stored-files.service';
import { validateImageFile } from '../common/files/image-validation';
import { processUploadedImage } from '../common/files/image-processing';
import { buildServiceAttachmentsPath } from '../common/files/storage-paths';
import { randomBytes, randomUUID } from 'crypto';
import { StoredFileKind } from '@prisma/client';
import { isExternalRole, withOwner } from '../common/compat/owner-role-compat';
import { RealtimeService } from '../realtime/realtime.service';
import { TranslationService } from '../ai/translation.service';

const SERVICE_ATTACHMENT_MAX_FILES = 10;
const SERVICE_ATTACHMENT_MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;
const SERVICE_ATTACHMENT_MAX_TOTAL_ORIGINAL_BYTES = 40 * 1024 * 1024;
const SERVICE_ATTACHMENT_MAX_DIMENSION = 6000;
const SERVICE_ATTACHMENT_MAX_PIXELS = 24 * 1024 * 1024;
const SERVICE_ATTACHMENT_OUTPUT_MAX_DIMENSION = 2000;
const SERVICE_ATTACHMENT_OUTPUT_QUALITY = 82;
const SERVICE_ATTACHMENT_OUTPUT_FORMAT = 'webp';
const SHARE_TOKEN_BYTES = 32;

interface ZipEntry {
  name: string;
  data: Buffer;
}

function resolveDateRange(preset?: string, startDate?: string, endDate?: string): { gte: Date; lte: Date } | undefined {
  const now = new Date();
  if (preset === 'Hoy') {
    return {
      gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)),
      lte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)),
    };
  }
  if (preset === 'Semana') {
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return { gte: start, lte: now };
  }
  if (preset === 'Mes') {
    const start = new Date(now);
    start.setDate(now.getDate() - 30);
    return {
      gte: start,
      lte: now,
    };
  }
  if (preset === 'Año') {
    const start = new Date(now);
    start.setFullYear(now.getFullYear() - 1);
    return { gte: start, lte: now };
  }
  if (preset === 'Personalizado' && startDate && endDate) {
    return {
      gte: new Date(startDate + 'T00:00:00.000Z'),
      lte: new Date(endDate + 'T23:59:59.999Z'),
    };
  }
  return undefined;
}

function sanitizeDownloadName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'archivo';
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

const crcTable = new Uint32Array(256).map((_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  }
  return crc >>> 0;
});

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, 'utf8');
    const entryCrc = crc32(entry.data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(entryCrc, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuffer, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(entryCrc, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + entry.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endHeader = Buffer.alloc(22);
  endHeader.writeUInt32LE(0x06054b50, 0);
  endHeader.writeUInt16LE(0, 4);
  endHeader.writeUInt16LE(0, 6);
  endHeader.writeUInt16LE(entries.length, 8);
  endHeader.writeUInt16LE(entries.length, 10);
  endHeader.writeUInt32LE(centralDirectory.length, 12);
  endHeader.writeUInt32LE(offset, 16);
  endHeader.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endHeader]);
}

function createSimplePdf(lines: string[]): Buffer {
  const safeLines = lines.map((line) => escapePdfText(line));
  const content = [
    'BT',
    '/F1 22 Tf',
    '50 780 Td',
    `(${safeLines[0] ?? 'Reporte de servicio'}) Tj`,
    '/F1 11 Tf',
    ...safeLines.slice(1).flatMap((line) => ['0 -22 Td', `(${line}) Tj`]),
    'ET',
  ].join('\n');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += object;
  }

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private storageGovernance: StorageGovernanceService,
    private storedFilesService: StoredFilesService,
    @Optional() private realtimeService?: RealtimeService,
    @Optional() private translationService?: TranslationService,
  ) {}

  private mapServiceRelations<T extends Record<string, any>>(service: T): T {
    if (!service.asset) {
      return service;
    }

    return {
      ...service,
      asset: {
        ...withOwner(service.asset),
      }
    };
  }

  private async resolveServiceFileUrls<T extends Record<string, any>>(service: T, organizationId: string): Promise<T> {
    const resolvedService = { ...service } as any;

    if (resolvedService.asset) {
      resolvedService.asset.thumbnail_url = await this.storedFilesService.resolveFileUrlForOrg(
        resolvedService.asset.thumbnail_file_id,
        organizationId,
      );
    }

    if (Array.isArray(resolvedService.attachments)) {
      resolvedService.attachments = await Promise.all(
        resolvedService.attachments.map(async (attachment: any) => ({
          ...attachment,
          file_url: await this.storedFilesService.resolveFileUrlForOrg(attachment.file_id, organizationId),
        }))
      );
    }

    return resolvedService;
  }

  private async applyDescriptionTranslation<T extends Record<string, any>>(service: T, lang?: string | null): Promise<T> {
    if (!this.translationService || !lang) {
      return {
        ...service,
        original_description: service.description ?? null,
        original_language: service.description_language ?? null,
        translated_language: null,
        is_translated: false,
        translation_status: 'original',
      };
    }

    const translated = await this.translationService.translateServiceDescription(service, lang);
    return {
      ...service,
      ...translated,
    };
  }

  private async prepareServiceResponse<T extends Record<string, any>>(
    service: T,
    organizationId: string,
    lang?: string | null,
  ): Promise<T> {
    const resolved = await this.resolveServiceFileUrls(this.mapServiceRelations(service), organizationId);
    return this.applyDescriptionTranslation(resolved, lang);
  }

  private generateShareToken(): string {
    return randomBytes(SHARE_TOKEN_BYTES).toString('base64url');
  }

  async create(createServiceDto: CreateServiceDto, user: any, files?: Express.Multer.File[]) {
    let serviceOrgId: string;

    if (user.role === 'SUPER_ADMIN') {
      const asset = await this.prisma.asset.findFirst({
        where: { id: createServiceDto.asset_id, is_active: true },
        select: { id: true, organization_id: true },
      });
      if (!asset) throw new BadRequestException('El activo indicado no existe');
      serviceOrgId = asset.organization_id;
    } else {
      const asset = await this.prisma.asset.findFirst({
        where: { id: createServiceDto.asset_id, organization_id: user.orgId, is_active: true },
        select: { id: true },
      });
      if (!asset) throw new BadRequestException('El activo indicado no pertenece a tu organización');
      serviceOrgId = user.orgId;
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: serviceOrgId },
      select: { auto_publish_services: true }
    });
    if (!org) throw new NotFoundException('Organization not found');

    if (files && files.length > SERVICE_ATTACHMENT_MAX_FILES) {
      throw new BadRequestException('Solo puedes adjuntar hasta 10 imagenes por servicio');
    }

    const totalOriginalBytes = files?.reduce((total, file) => total + file.size, 0) ?? 0;
    if (totalOriginalBytes > SERVICE_ATTACHMENT_MAX_TOTAL_ORIGINAL_BYTES) {
      throw new BadRequestException('Los adjuntos del servicio exceden el maximo total permitido');
    }

    const serviceId = randomUUID();
    const attachments: Array<{
      file_id: string;
      file_type: string;
      file_name: string;
      file_size_bytes: number;
    }> = [];
    const storedFileIds: string[] = [];
    const uploadedStorageRefs: string[] = [];

    try {
      for (const file of files ?? []) {
        const imageInfo = validateImageFile(file, {
          maxBytes: SERVICE_ATTACHMENT_MAX_ORIGINAL_BYTES,
          label: 'Adjunto de servicio',
          maxWidth: SERVICE_ATTACHMENT_MAX_DIMENSION,
          maxHeight: SERVICE_ATTACHMENT_MAX_DIMENSION,
          maxPixels: SERVICE_ATTACHMENT_MAX_PIXELS,
        });
        file.mimetype = imageInfo.mime;
        await processUploadedImage(file, {
          maxWidth: SERVICE_ATTACHMENT_OUTPUT_MAX_DIMENSION,
          maxHeight: SERVICE_ATTACHMENT_OUTPUT_MAX_DIMENSION,
          format: SERVICE_ATTACHMENT_OUTPUT_FORMAT,
          quality: SERVICE_ATTACHMENT_OUTPUT_QUALITY,
        });
      }

      const totalProcessedBytes = files?.reduce((total, file) => total + file.size, 0) ?? 0;
      await this.storageGovernance.assertCanStore(serviceOrgId, totalProcessedBytes);

      for (const file of files ?? []) {
        const file_url = await this.storageService.uploadFile(file, {
          folder: buildServiceAttachmentsPath(serviceOrgId, serviceId),
          visibility: 'private',
        });
        uploadedStorageRefs.push(file_url);
        const storedFile = await this.storedFilesService.registerUploadedFile({
          organizationId: serviceOrgId,
          storageRef: file_url,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          kind: StoredFileKind.SERVICE_ATTACHMENT,
          visibility: 'private',
          entityType: 'SERVICE',
          entityId: serviceId,
          uploadedByUserId: user.id,
        });
        storedFileIds.push(storedFile.id);
        const uploadedRefIndex = uploadedStorageRefs.indexOf(file_url);
        if (uploadedRefIndex !== -1) {
          uploadedStorageRefs.splice(uploadedRefIndex, 1);
        }
        attachments.push({
          file_id: storedFile.id,
          file_type: file.mimetype,
          file_name: file.originalname,
          file_size_bytes: file.size,
        });
      }

      const newService = await this.prisma.service.create({
        data: {
          id: serviceId,
          ...createServiceDto,
          organization_id: serviceOrgId,
          worker_id: user.id,
          is_public: org.auto_publish_services,
          status: 'COMPLETED',
          description_language: this.translationService?.detectLanguageHeuristic(createServiceDto.description) ?? null,
          attachments: {
            create: attachments,
          }
        },
        include: { attachments: true }
      });

      this.logger.log(`Service created: Asset [${createServiceDto.asset_id}] by Worker [${user.id}] with ${attachments.length} attachments`);
      const resolvedService = await this.prepareServiceResponse(newService, serviceOrgId);
      this.realtimeService?.emit({
        module: 'services',
        action: 'created',
        entityId: newService.id,
        organizationId: serviceOrgId,
        actorUserId: user.id,
      });

      return resolvedService;
    } catch (error) {
      await Promise.all([
        ...storedFileIds.map((id) => this.storedFilesService.deleteStoredFileAndBlob(id)),
        ...uploadedStorageRefs.map((ref) => this.storageService.deleteFile(ref)),
      ]);
      throw error;
    }
  }

  async findAll(query: ListServicesQueryDto, user: any) {
    const whereClause: any = { deleted_at: null, purged_at: null };

    if (user.role !== 'SUPER_ADMIN') {
      whereClause.organization_id = user.orgId;
    }
    
    if (query.asset_id) whereClause.asset_id = query.asset_id;
    if (query.worker_id) whereClause.worker_id = query.worker_id;

    if (user.role === 'WORKER') {
      whereClause.worker_id = user.id;
    }

    const dateRange = resolveDateRange(query.preset, query.startDate, query.endDate);
    if (dateRange) whereClause.created_at = dateRange;

    if (isExternalRole(user.role)) {
      const currentOwnerId = user.owner_id ?? null;
      if (!currentOwnerId) {
        return query.page && query.limit
          ? {
              data: [],
              meta: { total: 0, page: Number(query.page), limit: Number(query.limit), totalPages: 0 },
            }
          : [];
      }

      whereClause.is_public = true;
      whereClause.status = 'COMPLETED';
      whereClause.asset = { owner_id: currentOwnerId };
    }

    if (query.search) {
      whereClause.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { worker: { name: { contains: query.search, mode: 'insensitive' } } },
        { asset: { name: { contains: query.search, mode: 'insensitive' } } }
      ];
    }

    if (query.page && query.limit) {
      const page = Number(query.page);
      const limit = Number(query.limit);
      const [data, total] = await Promise.all([
        this.prisma.service.findMany({
          where: whereClause,
          include: {
            worker: { select: { id: true, name: true, deleted_at: true, purged_at: true } },
            asset: { select: { id: true, name: true, location: true, owner_id: true, thumbnail_file_id: true, deleted_at: true, purged_at: true, owner: { select: { id: true, name: true, deleted_at: true, purged_at: true } } } },
            attachments: {
              select: { id: true, file_id: true, file_type: true },
              orderBy: { created_at: 'asc' },
            },
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        this.prisma.service.count({ where: whereClause })
      ]);
      const mappedData = await Promise.all(
        data.map(async (item: any) => this.prepareServiceResponse(item, item.organization_id, query.lang))
      );

      return {
        data: mappedData,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
      };
    }

    const services = await this.prisma.service.findMany({
      where: whereClause,
      include: {
        worker: { select: { id: true, name: true, deleted_at: true, purged_at: true } },
        asset: { select: { id: true, name: true, location: true, owner_id: true, thumbnail_file_id: true, deleted_at: true, purged_at: true, owner: { select: { id: true, name: true, deleted_at: true, purged_at: true } } } },
        attachments: {
          select: { id: true, file_id: true, file_type: true },
          orderBy: { created_at: 'asc' },
        },
      },
      orderBy: { created_at: 'desc' }
    });
    return Promise.all(
      services.map(async (item: any) => this.prepareServiceResponse(item, item.organization_id, query.lang))
    );
  }

  async getStats(query: ServiceStatsQueryDto, user: any) {
    const baseWhere: any = { deleted_at: null, purged_at: null };

    if (user.role !== 'SUPER_ADMIN') {
      baseWhere.organization_id = user.orgId;
    }

    if (query.asset_id) baseWhere.asset_id = query.asset_id;
    if (query.worker_id) baseWhere.worker_id = query.worker_id;

    if (user.role === 'WORKER') {
      baseWhere.worker_id = user.id;
    }

    if (isExternalRole(user.role)) {
      const currentOwnerId = user.owner_id ?? null;
      if (!currentOwnerId) {
        return { total_services: 0, period_services: 0, assets_serviced: 0, active_operators: 0 };
      }
      baseWhere.is_public = true;
      baseWhere.status = 'COMPLETED';
      baseWhere.asset = { owner_id: currentOwnerId };
    }

    const periodWhere: any = { ...baseWhere };

    const dateRange = resolveDateRange(query.preset, query.startDate, query.endDate);
    if (dateRange) periodWhere.created_at = dateRange;

    const [total_services, period_services, assetGroups, workerGroups] = await Promise.all([
      this.prisma.service.count({ where: baseWhere }),
      this.prisma.service.count({ where: periodWhere }),
      this.prisma.service.groupBy({ by: ['asset_id'], where: periodWhere }),
      this.prisma.service.groupBy({ by: ['worker_id'], where: { ...periodWhere, worker_id: { not: null } } }),
    ]);

    return {
      total_services,
      period_services,
      assets_serviced: assetGroups.length,
      active_operators: workerGroups.length,
    };
  }

  async getFilterOptions(user: any) {
    const serviceWhere: any = { deleted_at: null, purged_at: null };

    if (user.role !== 'SUPER_ADMIN') {
      serviceWhere.organization_id = user.orgId;
    }

    if (user.role === 'WORKER') {
      serviceWhere.worker_id = user.id;
    }

    if (isExternalRole(user.role)) {
      const currentOwnerId = user.owner_id ?? null;
      if (!currentOwnerId) {
        return { workers: [], assets: [] };
      }

      serviceWhere.is_public = true;
      serviceWhere.status = 'COMPLETED';
      serviceWhere.asset = { owner_id: currentOwnerId };
    }

    const [workers, assets] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          services_created: { some: serviceWhere },
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.asset.findMany({
        where: {
          services: { some: serviceWhere },
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return { workers, assets };
  }

  async update(id: string, updateServiceDto: UpdateServiceDto, orgId: string) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service || service.organization_id !== orgId || service.deleted_at || (service as any).purged_at) {
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

  async findOne(id: string, user: any, lang?: string) {
    const where: any = { id, deleted_at: null, purged_at: null };
    if (user.role !== 'SUPER_ADMIN') {
      where.organization_id = user.orgId;
    }

    const service = await this.prisma.service.findFirst({
      where,
      include: {
        attachments: { orderBy: { created_at: 'asc' } },
        worker: { select: { name: true, id: true, deleted_at: true, purged_at: true } },
        asset: { select: { name: true, id: true, category: true, owner_id: true, location: true, thumbnail_file_id: true, deleted_at: true, purged_at: true, owner: { select: { id: true, name: true, deleted_at: true, purged_at: true } } } }
      }
    });

    if (!service) {
      throw new NotFoundException('Service no encontrado');
    }

    if (isExternalRole(user.role)) {
      if (!service.is_public) {
        throw new ForbiddenException('No tienes permiso para ver este servicio privado');
      }

      const currentOwnerId = user.owner_id ?? null;
      if (!currentOwnerId || service.asset.owner_id !== currentOwnerId) {
        throw new NotFoundException('Service no encontrado o acceso denegado');
      }
    }

    return this.prepareServiceResponse(service, service.organization_id, lang);
  }

  async getOrCreateShareLink(id: string, user: any) {
    if (isExternalRole(user.role)) {
      throw new ForbiddenException('No tienes permiso para compartir este servicio');
    }

    const where: any = { id, deleted_at: null, purged_at: null };
    if (user.role !== 'SUPER_ADMIN') {
      where.organization_id = user.orgId;
    }

    const service = await this.prisma.service.findFirst({
      where,
      select: { id: true, organization_id: true },
    });

    if (!service) {
      throw new NotFoundException('Service no encontrado');
    }

    const existingLink = await this.prisma.serviceShareLink.findFirst({
      where: {
        service_id: service.id,
        is_enabled: true,
      },
      orderBy: { created_at: 'desc' },
    });

    if (existingLink) {
      return {
        token: existingLink.token,
        allow_downloads: existingLink.allow_downloads,
        expires_at: existingLink.expires_at,
      };
    }

    let token = this.generateShareToken();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const tokenExists = await this.prisma.serviceShareLink.findUnique({ where: { token } });
      if (!tokenExists) break;
      token = this.generateShareToken();
    }

    const shareLink = await this.prisma.serviceShareLink.create({
      data: {
        service_id: service.id,
        token,
        created_by_user_id: user.id,
      },
    });

    return {
      token: shareLink.token,
      allow_downloads: shareLink.allow_downloads,
      expires_at: shareLink.expires_at,
    };
  }

  async getPublicSharedService(token: string, lang?: string) {
    const shareLink = await this.prisma.serviceShareLink.findUnique({
      where: { token },
      include: {
        service: {
          include: {
            organization: { select: { name: true, logo_file_id: true, default_asset_icon: true } },
            attachments: { orderBy: { created_at: 'asc' } },
            worker: { select: { name: true, id: true, deleted_at: true, purged_at: true } },
            asset: {
              select: {
                name: true,
                id: true,
                category: true,
                owner_id: true,
                location: true,
                thumbnail_file_id: true,
                deleted_at: true,
                purged_at: true,
                owner: { select: { id: true, name: true, deleted_at: true, purged_at: true } },
              },
            },
          },
        },
      },
    });

    if (!shareLink || !shareLink.is_enabled || shareLink.service.deleted_at || (shareLink.service as any).purged_at) {
      throw new NotFoundException('Link compartido no encontrado');
    }

    if (shareLink.expires_at && shareLink.expires_at.getTime() < Date.now()) {
      throw new NotFoundException('Link compartido expirado');
    }

    const resolvedService = await this.prepareServiceResponse(
      shareLink.service,
      shareLink.service.organization_id,
      lang,
    );

    const organizationLogoUrl = await this.storedFilesService.resolveFileUrlForOrg(
      shareLink.service.organization.logo_file_id,
      shareLink.service.organization_id,
    );

    return {
      token: shareLink.token,
      allow_downloads: shareLink.allow_downloads,
      service: {
        id: resolvedService.id,
        asset_id: resolvedService.asset_id,
        title: resolvedService.title,
        description: resolvedService.description,
        status: resolvedService.status,
        is_public: resolvedService.is_public,
        created_at: resolvedService.created_at,
        asset: resolvedService.asset,
        worker: resolvedService.worker,
        attachments: resolvedService.attachments,
        organization: {
          name: shareLink.service.organization.name,
          logo_url: organizationLogoUrl,
          default_asset_icon: shareLink.service.organization.default_asset_icon,
        },
      },
    };
  }

  async generateSharedServicePhotosZip(token: string, baseUrl: string): Promise<{ fileName: string; buffer: Buffer }> {
    const shared = await this.getPublicSharedService(token);
    if (!shared.allow_downloads) {
      throw new ForbiddenException('La descarga de fotos esta desactivada');
    }

    const imageAttachments = (shared.service.attachments ?? []).filter(
      (attachment: any) => attachment.file_url && attachment.file_type?.startsWith('image/'),
    );

    if (imageAttachments.length === 0) {
      throw new NotFoundException('No hay fotos para descargar');
    }

    const entries: ZipEntry[] = [];
    for (let index = 0; index < imageAttachments.length; index += 1) {
      const attachment = imageAttachments[index] as any;
      const fileUrl = String(attachment.file_url);
      const resolvedUrl = fileUrl.startsWith('http') ? fileUrl : `${baseUrl}${fileUrl}`;
      const response = await fetch(resolvedUrl);
      if (!response.ok) {
        continue;
      }

      const data = Buffer.from(await response.arrayBuffer());
      const extension = attachment.file_type?.split('/')[1] || 'webp';
      const fallbackName = `foto-${index + 1}.${extension}`;
      entries.push({
        name: sanitizeDownloadName(attachment.file_name || fallbackName),
        data,
      });
    }

    if (entries.length === 0) {
      throw new NotFoundException('No se pudieron preparar las fotos');
    }

    return {
      fileName: `${sanitizeDownloadName(shared.service.title)}-fotos.zip`,
      buffer: createZip(entries),
    };
  }

  async generateSharedServiceReportPdf(token: string): Promise<{ fileName: string; buffer: Buffer }> {
    const shared = await this.getPublicSharedService(token);
    const service = shared.service;
    const lines = [
      `Reporte de servicio: ${service.title}`,
      `Organizacion: ${service.organization?.name ?? 'Recall'}`,
      `Fecha: ${service.created_at instanceof Date ? service.created_at.toISOString().slice(0, 10) : String(service.created_at).slice(0, 10)}`,
      `Activo: ${service.asset?.name ?? 'Sin activo'}`,
      `Responsable: ${service.worker?.name ?? 'No registrado'}`,
      `Estado: ${service.status}`,
      '',
      'Descripcion:',
      service.description || 'Sin descripcion registrada.',
      '',
      `Evidencia fotografica: ${(service.attachments ?? []).filter((attachment: any) => attachment.file_type?.startsWith('image/')).length} foto(s)`,
    ];

    return {
      fileName: `${sanitizeDownloadName(service.title)}-reporte.pdf`,
      buffer: createSimplePdf(lines),
    };
  }

  async remove(id: string, user: any) {
    const service = await this.prisma.service.findUnique({ where: { id } });

    if (!service || service.deleted_at || (service as any).purged_at) {
      throw new NotFoundException('Service no encontrado');
    }

    if (user.role !== 'SUPER_ADMIN' && service.organization_id !== user.orgId) {
      throw new ForbiddenException('Acceso denegado para eliminar este servicio');
    }

    return this.prisma.service.update({
      where: { id },
      data: { deleted_at: new Date(), deleted_by_id: user.id },
    });
  }

}
