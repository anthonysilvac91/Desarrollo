import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { AuthGuard } from '../auth/auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

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

  @Post()
  @ApiOperation({ summary: 'Crear nueva organización e invitar al Admin inicial (Solo SUPER_ADMIN)' })
  create(@Body() dto: CreateOrganizationDto, @Request() req) {
    if (req.user.role !== 'SUPER_ADMIN') throw new ForbiddenException('Solo SUPER_ADMIN puede crear organizaciones');
    return this.orgService.create(dto, req.user.id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Activar o desactivar una organización (Solo SUPER_ADMIN)' })
  toggleStatus(@Param('id') id: string, @Body('is_active') is_active: boolean, @Request() req) {
    if (req.user.role !== 'SUPER_ADMIN') throw new ForbiddenException('Solo SUPER_ADMIN puede cambiar el estado de la organización');
    if (typeof is_active !== 'boolean') throw new ForbiddenException('is_active debe ser booleano');
    return this.orgService.toggleStatus(id, is_active);
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Actualizar parámetros de la Organización (Solo Admin)' })
  updateSettings(@Body() dto: UpdateOrganizationSettingsDto, @Request() req) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Solo ADMIN puede cambiar configuraciones');
    return this.orgService.updateSettings(req.user.orgId, dto);
  }
}
