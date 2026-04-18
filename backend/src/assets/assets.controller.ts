import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { AuthGuard } from '../auth/auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo activo', description: 'Disponible para Worker y Admin. El activo nace sin cliente.' })
  create(@Body() createAssetDto: CreateAssetDto, @Request() req) {
    return this.assetsService.create(createAssetDto, req.user.orgId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar activos según rol', description: 'El backend filtra: Admin/Worker ven todo, Client ve vinculados.' })
  findAll(@Request() req) {
    return this.assetsService.findAll(req.user.orgId, req.user.role, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un activo', description: 'Incluye historial de servicios y accesos de clientes. Filtra por tenant y permisos.' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.assetsService.findOne(id, req.user);
  }

  @Post(':id/clients/:clientId')
  @ApiOperation({ summary: 'Vincular cliente a un Activo (Solo Admin)' })
  assignClient(@Param('id') assetId: string, @Param('clientId') clientId: string, @Request() req) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Solo ADMIN puede asignar');
    return this.assetsService.assignClient(assetId, clientId, req.user.orgId, req.user.id);
  }

  @Delete(':id/clients/:clientId')
  @ApiOperation({ summary: 'Desvincular cliente de un Activo (Solo Admin)' })
  removeClient(@Param('id') assetId: string, @Param('clientId') clientId: string, @Request() req) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Solo ADMIN puede desasignar');
    return this.assetsService.removeClient(assetId, clientId, req.user.orgId);
  }
}
