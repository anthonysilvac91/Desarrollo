import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Crear un nuevo activo', description: 'Disponible para Worker y Admin.' })
  create(@Body() createAssetDto: CreateAssetDto, @Request() req, @UploadedFile() photo?: Express.Multer.File) {
    if (!['SUPER_ADMIN', 'ADMIN', 'WORKER'].includes(req.user.role)) {
      throw new ForbiddenException('No tienes permiso para crear activos');
    }
    return this.assetsService.create(createAssetDto, req.user.orgId, photo);
  }

  @Get()
  @ApiOperation({ summary: 'Listar activos segun rol', description: 'El backend filtra: Admin/Worker ven todo, Client ve vinculados.' })
  findAll(@Query() query: PaginationQueryDto, @Request() req) {
    return this.assetsService.findAll(
      query,
      req.user.orgId,
      req.user.role,
      req.user.id,
      req.user.company_id ?? req.user.customer_id,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un activo', description: 'Incluye historial de servicios y acceso de companies. Filtra por tenant y permisos.' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.assetsService.findOne(id, req.user);
  }

  @Post(':id/companies/:companyId')
  @ApiOperation({ summary: 'Vincular una company a un activo (Solo Admin)' })
  assignCompany(@Param('id') assetId: string, @Param('companyId') companyId: string, @Request() req) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Solo ADMIN puede asignar');
    return this.assetsService.assignCompany(assetId, companyId, req.user.orgId);
  }

  @Post(':id/clients/:clientId')
  @ApiOperation({ summary: 'Vincular una company a un activo (Solo Admin)', description: 'Ruta legacy. El parametro clientId representa el id de la company.' })
  assignClient(@Param('id') assetId: string, @Param('clientId') clientId: string, @Request() req) {
    return this.assignCompany(assetId, clientId, req);
  }

  @Delete(':id/companies/:companyId')
  @ApiOperation({ summary: 'Desvincular una company de un activo (Solo Admin)' })
  removeCompany(@Param('id') assetId: string, @Param('companyId') companyId: string, @Request() req) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Solo ADMIN puede desasignar');
    return this.assetsService.removeCompany(assetId, companyId, req.user.orgId);
  }

  @Delete(':id/clients/:clientId')
  @ApiOperation({ summary: 'Desvincular una company de un activo (Solo Admin)', description: 'Ruta legacy. El parametro clientId representa el id de la company.' })
  removeClient(@Param('id') assetId: string, @Param('clientId') clientId: string, @Request() req) {
    return this.removeCompany(assetId, clientId, req);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un activo permanentemente' })
  remove(@Param('id') id: string, @Request() req) {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') throw new ForbiddenException('No tienes permiso para borrar activos');
    return this.assetsService.remove(id, req.user);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Actualizar un activo existente' })
  update(@Param('id') id: string, @Body() updateAssetDto: any, @Request() req, @UploadedFile() photo?: Express.Multer.File) {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('No tienes permiso para editar activos');
    }
    return this.assetsService.update(id, updateAssetDto, req.user.orgId, req.user.role, photo);
  }
}
