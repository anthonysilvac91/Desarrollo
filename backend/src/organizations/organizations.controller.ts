import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';
import { OrganizationsService } from './organizations.service';
import { imageUploadOptions } from '../common/files/multer-image-options';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgService: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todas las organizaciones (Solo SUPER_ADMIN)' })
  findAll(@Request() req) {
    if (req.user.role !== 'SUPER_ADMIN') throw new ForbiddenException('Solo SUPER_ADMIN puede listar las organizaciones');
    return this.orgService.findAll();
  }

  @Get('me')
  @ApiOperation({ summary: 'Obtener datos de la organizacion propia (Solo Admin/Worker/Client)' })
  findOneMe(@Request() req) {
    if (!req.user.orgId) throw new ForbiddenException('El usuario no pertenece a ninguna organizacion');
    return this.orgService.findOne(req.user.orgId);
  }

  @Get('me/storage')
  @ApiOperation({ summary: 'Obtener uso de storage de la organizacion (Solo Admin)' })
  getStorageUsage(@Request() req) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Solo ADMIN puede ver uso de storage');
    return this.orgService.getStorageUsage(req.user.orgId);
  }

  @Post('me/storage/reconcile')
  @ApiOperation({ summary: 'Reconciliar archivos huerfanos de storage (Solo Admin)' })
  reconcileStorage(@Request() req, @Body('delete_orphans') deleteOrphans?: boolean) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Solo ADMIN puede reconciliar storage');
    return this.orgService.reconcileStorage(req.user.orgId, Boolean(deleteOrphans));
  }

  @Post()
  @ApiOperation({ summary: 'Crear nueva organizacion e invitar al Admin inicial (Solo SUPER_ADMIN)' })
  create(@Body() dto: CreateOrganizationDto, @Request() req) {
    if (req.user.role !== 'SUPER_ADMIN') throw new ForbiddenException('Solo SUPER_ADMIN puede crear organizaciones');
    return this.orgService.create(dto, req.user.id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Activar o desactivar una organizacion (Solo SUPER_ADMIN)' })
  toggleStatus(@Param('id') id: string, @Body('is_active') is_active: boolean, @Request() req) {
    if (req.user.role !== 'SUPER_ADMIN') throw new ForbiddenException('Solo SUPER_ADMIN puede cambiar el estado de la organizacion');
    if (typeof is_active !== 'boolean') throw new ForbiddenException('is_active debe ser booleano');
    return this.orgService.toggleStatus(id, is_active);
  }

  @Patch('settings')
  @UseInterceptors(FileInterceptor('logo', imageUploadOptions(2 * 1024 * 1024)))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Actualizar parametros de la Organizacion (Solo Admin)' })
  updateSettings(
    @Body() dto: UpdateOrganizationSettingsDto,
    @Request() req,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Solo ADMIN puede cambiar configuraciones');
    return this.orgService.updateSettings(req.user.orgId, dto, file);
  }
}
