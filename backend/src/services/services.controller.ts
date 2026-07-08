import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import { ServiceStatsQueryDto } from './dto/service-stats-query.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PlanLimitGuard, CheckPlanLimit } from '../subscriptions/check-plan-limit.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { fileUploadOptions } from '../common/files/multer-image-options';
import { CreateServiceWithUploadManifestDto } from '../uploads/dto/create-service-with-upload-manifest.dto';
import { UploadsService } from '../uploads/uploads.service';

@ApiTags('Services')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('services')
export class ServicesController {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly uploadsService: UploadsService,
  ) {}

  @Get('attachment-config')
  @ApiOperation({ summary: 'Configuracion efectiva para adjuntos de servicio' })
  getAttachmentConfig(@Request() req) {
    return this.uploadsService.getAttachmentConfig(req.user);
  }

  @Post()
  @UseGuards(PlanLimitGuard)
  @CheckPlanLimit('services')
  @ApiOperation({
    summary: 'Registrar un servicio ejecutado',
    description:
      'Crea el servicio y aplica visibilidad según la configuración de la organización.',
  })
  @UseInterceptors(
    FilesInterceptor('files', 30, fileUploadOptions(10 * 1024 * 1024)),
  )
  create(
    @Body() createServiceDto: CreateServiceDto,
    @Request() req,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!['SUPER_ADMIN', 'ADMIN', 'WORKER'].includes(req.user.role)) {
      throw new ForbiddenException(
        'No tienes permiso para registrar servicios',
      );
    }
    return this.servicesService.create(createServiceDto, req.user, files);
  }

  @Post('with-upload-manifest')
  @ApiOperation({
    summary: 'Crear servicio y preparar manifiesto de cargas directas',
  })
  createWithUploadManifest(
    @Body() dto: CreateServiceWithUploadManifestDto,
    @Request() req,
  ) {
    if (!['SUPER_ADMIN', 'ADMIN', 'WORKER'].includes(req.user.role)) {
      throw new ForbiddenException(
        'No tienes permiso para registrar servicios',
      );
    }
    return this.servicesService.createWithUploadManifest(dto, req.user);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar historial de servicios',
    description:
      'Dependiendo del rol que acceda y el param asset_id, devuelve todo o filtra los no públicos.',
  })
  findAll(@Query() query: ListServicesQueryDto, @Request() req) {
    return this.servicesService.findAll(query, req.user);
  }

  @Get('stats')
  @ApiOperation({ summary: 'KPI aggregates for the services view' })
  getStats(@Query() query: ServiceStatsQueryDto, @Request() req) {
    return this.servicesService.getStats(query, req.user);
  }

  @Get('filter-options')
  @ApiOperation({ summary: 'Opciones livianas para filtros de servicios' })
  getFilterOptions(@Request() req) {
    return this.servicesService.getFilterOptions(req.user);
  }

  @Post(':id/share-link')
  @ApiOperation({
    summary: 'Crear u obtener link publico para compartir un servicio',
  })
  getOrCreateShareLink(@Param('id') id: string, @Request() req) {
    return this.servicesService.getOrCreateShareLink(id, req.user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Editar un Service (solo ADMIN)',
    description: 'Admite modificación de datos, status y visibilidad.',
  })
  update(
    @Param('id') id: string,
    @Body() updateServiceDto: UpdateServiceDto,
    @Request() req,
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Solo un Admin puede editar los Services en esta fase MVP',
      );
    }
    return this.servicesService.update(
      id,
      updateServiceDto,
      req.user.orgId,
      req.user.id,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalle de un servicio',
    description:
      'Retorna el servicio con sus adjuntos, operario y activo relacionado.',
  })
  findOne(
    @Param('id') id: string,
    @Query('lang') lang: string | undefined,
    @Request() req,
  ) {
    return this.servicesService.findOne(id, req.user, lang);
  }

  @Get(':id/attachments/:attachmentId/download')
  @ApiOperation({
    summary: 'Obtener URL de descarga de un adjunto de servicio',
  })
  downloadAttachment(
    @Param('id') serviceId: string,
    @Param('attachmentId') attachmentId: string,
    @Request() req,
  ) {
    return this.servicesService.getAttachmentDownloadUrl(
      serviceId,
      attachmentId,
      req.user,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar un servicio',
    description: 'Elimina un servicio de forma permanente.',
  })
  remove(@Param('id') id: string, @Request() req) {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('No tienes permiso para eliminar servicios');
    }
    return this.servicesService.remove(id, req.user);
  }
}
