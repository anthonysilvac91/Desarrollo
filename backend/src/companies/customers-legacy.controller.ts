import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Request, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { legacyRouteDescription, markLegacyResponse } from '../common/http/legacy-api';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('customers-legacy')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('customers')
export class CustomersLegacyController {
  constructor(private readonly companiesService: CompaniesService) {}

  private markDeprecated(res: Response) {
    markLegacyResponse(res);
  }

  @Post()
  @ApiOperation({ summary: '[Deprecated] Crear una company', deprecated: true, description: legacyRouteDescription('/owners') })
  create(@Body() createCompanyDto: CreateCompanyDto, @Request() req, @Res({ passthrough: true }) res: Response) {
    this.markDeprecated(res);
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para crear companies');
    }
    return this.companiesService.create(createCompanyDto, req.user.orgId);
  }

  @Get()
  @ApiOperation({ summary: '[Deprecated] Obtener todas las companies de la organizacion', deprecated: true, description: legacyRouteDescription('/owners') })
  findAll(@Request() req, @Query() query: PaginationQueryDto, @Res({ passthrough: true }) res: Response) {
    this.markDeprecated(res);
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para listar companies');
    }
    return this.companiesService.findAll(req.user.orgId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '[Deprecated] Obtener detalles de una company', deprecated: true, description: legacyRouteDescription('/owners') })
  findOne(@Param('id') id: string, @Request() req, @Res({ passthrough: true }) res: Response) {
    this.markDeprecated(res);
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para ver companies');
    }
    return this.companiesService.findOne(id, req.user.orgId);
  }

  @Patch(':id')
  @ApiOperation({ summary: '[Deprecated] Actualizar una company', deprecated: true, description: legacyRouteDescription('/owners') })
  update(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto, @Request() req, @Res({ passthrough: true }) res: Response) {
    this.markDeprecated(res);
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para actualizar companies');
    }
    return this.companiesService.update(id, updateCompanyDto, req.user.orgId);
  }

  @Delete(':id')
  @ApiOperation({ summary: '[Deprecated] Eliminar logicamente una company', deprecated: true, description: legacyRouteDescription('/owners') })
  remove(@Param('id') id: string, @Request() req, @Res({ passthrough: true }) res: Response) {
    this.markDeprecated(res);
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para eliminar companies');
    }
    return this.companiesService.remove(id, req.user.orgId);
  }
}
