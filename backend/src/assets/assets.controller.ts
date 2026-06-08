import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import { AssetQueryDto } from './dto/asset-query.dto';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { imageUploadOptions } from '../common/files/multer-image-options';
import { ASSET_IMAGE_MAX_BYTES } from './asset-upload-limits';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('photo', imageUploadOptions(ASSET_IMAGE_MAX_BYTES)))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Crear un nuevo activo', description: 'Disponible para Worker y Admin.' })
  create(@Body() createAssetDto: CreateAssetDto, @Request() req, @UploadedFile() photo?: Express.Multer.File) {
    if (!['SUPER_ADMIN', 'ADMIN', 'WORKER'].includes(req.user.role)) {
      throw new ForbiddenException('No tienes permiso para crear activos');
    }
    return this.assetsService.create(createAssetDto, req.user.orgId, photo);
  }

  @Get()
  @ApiOperation({ summary: 'Listar activos segun rol', description: 'El backend filtra: Admin/Worker ven todo, EXTERNAL ve los activos vinculados a su owner.' })
  findAll(@Query() query: AssetQueryDto, @Request() req) {
    return this.assetsService.findAll(
      query,
      req.user.orgId,
      req.user.role,
      req.user.owner_id ?? undefined,
    );
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estadísticas generales de activos' })
  getStats(@Request() req) {
    return this.assetsService.getStats(req.user.orgId, req.user.role, req.user.owner_id ?? undefined);
  }

  @Get('filter-options')
  @ApiOperation({ summary: 'Opciones livianas para filtros de activos' })
  getFilterOptions(@Request() req) {
    return this.assetsService.getFilterOptions(
      req.user.orgId,
      req.user.role,
      req.user.owner_id ?? undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un activo', description: 'Incluye historial de servicios y acceso de companies. Filtra por tenant y permisos.' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.assetsService.findOne(id, req.user);
  }

  @Post(':id/owners/:ownerId')
  @ApiOperation({ summary: 'Vincular un owner a un activo (Solo Admin)' })
  assignOwner(@Param('id') assetId: string, @Param('ownerId') ownerId: string, @Request() req) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Solo ADMIN puede asignar');
    return this.assetsService.assignOwner(assetId, ownerId, req.user.orgId);
  }

  @Delete(':id/owners/:ownerId')
  @ApiOperation({ summary: 'Desvincular un owner de un activo (Solo Admin)' })
  removeOwner(@Param('id') assetId: string, @Param('ownerId') ownerId: string, @Request() req) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Solo ADMIN puede desasignar');
    return this.assetsService.removeOwner(assetId, ownerId, req.user.orgId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Activar o desactivar un activo (solo Admin)' })
  toggleStatus(@Param('id') id: string, @Body('is_active') is_active: boolean, @Request() req) {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      throw new ForbiddenException('No tienes permiso para cambiar el estado de activos');
    }
    return this.assetsService.toggleStatus(id, is_active, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un activo permanentemente' })
  remove(@Param('id') id: string, @Request() req) {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') throw new ForbiddenException('No tienes permiso para borrar activos');
    return this.assetsService.remove(id, req.user);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('photo', imageUploadOptions(ASSET_IMAGE_MAX_BYTES)))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Actualizar un activo existente' })
  update(@Param('id') id: string, @Body() updateAssetDto: UpdateAssetDto, @Request() req, @UploadedFile() photo?: Express.Multer.File) {
    if (!['SUPER_ADMIN', 'ADMIN', 'WORKER'].includes(req.user.role)) {
      throw new ForbiddenException('No tienes permiso para editar activos');
    }
    return this.assetsService.update(id, updateAssetDto, req.user.orgId, req.user.role, photo);
  }
}
