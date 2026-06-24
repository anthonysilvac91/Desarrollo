import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { CreateUploadIntentDto } from './dto/create-upload-intent.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { UploadsService } from './uploads.service';
import { UploadMaintenanceService } from './upload-maintenance.service';
import { UploadReconciliationService } from './upload-reconciliation.service';

@ApiTags('Uploads')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
export class UploadsController {
  constructor(
    private readonly uploadsService: UploadsService,
    private readonly maintenanceService: UploadMaintenanceService,
    private readonly reconciliationService: UploadReconciliationService,
  ) {}

  @Get('services/attachment-config')
  @ApiOperation({ summary: 'Configuracion efectiva para adjuntos de servicio' })
  getAttachmentConfig(@Request() req) {
    return this.uploadsService.getAttachmentConfig(req.user);
  }

  @Post('services/:serviceId/attachments/upload-intents')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @ApiOperation({ summary: 'Crear intencion de carga directa a Supabase' })
  createIntent(
    @Param('serviceId') serviceId: string,
    @Body() dto: CreateUploadIntentDto,
    @Request() req,
  ) {
    return this.uploadsService.createIntent(serviceId, dto, req.user);
  }

  @Post('services/:serviceId/attachments/:uploadId/start')
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  @ApiOperation({ summary: 'Marcar inicio de carga' })
  markStarted(
    @Param('serviceId') serviceId: string,
    @Param('uploadId') uploadId: string,
    @Request() req,
  ) {
    return this.uploadsService.markStarted(serviceId, uploadId, req.user);
  }

  @Post('services/:serviceId/attachments/:uploadId/confirm')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Confirmar objeto subido y registrar attachment' })
  confirm(
    @Param('serviceId') serviceId: string,
    @Param('uploadId') uploadId: string,
    @Body() _dto: ConfirmUploadDto,
    @Request() req,
  ) {
    return this.uploadsService.confirm(serviceId, uploadId, req.user);
  }

  @Patch('services/:serviceId/attachments/:uploadId/progress')
  @Throttle({ default: { ttl: 60000, limit: 120 } })
  @ApiOperation({ summary: 'Actualizar progreso agregado de una carga' })
  progress(
    @Param('serviceId') serviceId: string,
    @Param('uploadId') uploadId: string,
    @Body() body: any,
    @Request() req,
  ) {
    return this.uploadsService.updateProgress(
      serviceId,
      uploadId,
      body,
      req.user,
    );
  }

  @Post('services/:serviceId/attachments/:uploadId/retry')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @ApiOperation({ summary: 'Renovar token de una carga pendiente o fallida' })
  retry(
    @Param('serviceId') serviceId: string,
    @Param('uploadId') uploadId: string,
    @Request() req,
  ) {
    return this.uploadsService.retry(serviceId, uploadId, req.user);
  }

  @Delete('services/:serviceId/attachments/uploads/:uploadId')
  @Delete('services/:serviceId/attachments/:uploadId')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Cancelar carga pendiente' })
  cancel(
    @Param('serviceId') serviceId: string,
    @Param('uploadId') uploadId: string,
    @Request() req,
  ) {
    return this.uploadsService.cancel(serviceId, uploadId, req.user);
  }

  @Post('services/:serviceId/attachments/:attachmentId/playback-url')
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  @ApiOperation({
    summary: 'Obtener URL firmada bajo demanda para reproducir video',
  })
  playbackUrl(
    @Param('serviceId') serviceId: string,
    @Param('attachmentId') attachmentId: string,
    @Request() req,
  ) {
    return this.uploadsService.getPlaybackUrl(
      serviceId,
      attachmentId,
      req.user,
    );
  }

  @Post('services/:serviceId/attachments/finalize-with-failures')
  @ApiOperation({ summary: 'Descartar cargas fallidas o pendientes restantes' })
  finalizeWithFailures(@Param('serviceId') serviceId: string, @Request() req) {
    return this.uploadsService.finalizeWithFailures(serviceId, req.user);
  }

  @Get('uploads/mine')
  @ApiOperation({ summary: 'Listar cargas propias' })
  getMine(@Query('status') status: string | undefined, @Request() req) {
    return this.uploadsService.getMine(req.user, status);
  }

  @Post('uploads/maintenance/run')
  @ApiOperation({ summary: 'Ejecutar mantenimiento de uploads manualmente' })
  runMaintenance(@Request() req) {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      throw new ForbiddenException(
        'Solo un Admin puede ejecutar mantenimiento',
      );
    }
    return this.maintenanceService.runHourlyMaintenance();
  }

  @Post('uploads/reconcile')
  @ApiOperation({
    summary: 'Reconciliar almacenamiento de la organizacion actual',
  })
  reconcile(@Request() req) {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      throw new ForbiddenException(
        'Solo un Admin puede reconciliar almacenamiento',
      );
    }
    if (req.user.role === 'SUPER_ADMIN' && !req.user.orgId) {
      return this.reconciliationService.reconcileAllOrganizations();
    }
    return this.reconciliationService.reconcileOrganization(req.user.orgId);
  }
}
