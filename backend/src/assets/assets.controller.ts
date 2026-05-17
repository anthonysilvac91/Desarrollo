import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { imageUploadOptions } from '../common/files/multer-image-options';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('photo', imageUploadOptions(5 * 1024 * 1024)))
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
  findAll(@Query() query: PaginationQueryDto, @Request() req) {
    return this.assetsService.findAll(
      query,
      req.user.orgId,
      req.user.role,
      req.user.id,
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
    return this.assetsService.assignCompany(assetId, ownerId, req.user.orgId);
  }

  @Delete(':id/owners/:ownerId')
  @ApiOperation({ summary: 'Desvincular un owner de un activo (Solo Admin)' })
  removeOwner(@Param('id') assetId: string, @Param('ownerId') ownerId: string, @Request() req) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Solo ADMIN puede desasignar');
    return this.assetsService.removeCompany(assetId, ownerId, req.user.orgId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un activo permanentemente' })
  remove(@Param('id') id: string, @Request() req) {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') throw new ForbiddenException('No tienes permiso para borrar activos');
    return this.assetsService.remove(id, req.user);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('photo', imageUploadOptions(5 * 1024 * 1024)))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Actualizar un activo existente' })
  update(@Param('id') id: string, @Body() updateAssetDto: any, @Request() req, @UploadedFile() photo?: Express.Multer.File) {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('No tienes permiso para editar activos');
    }
    return this.assetsService.update(id, updateAssetDto, req.user.orgId, req.user.role, photo);
  }
}
