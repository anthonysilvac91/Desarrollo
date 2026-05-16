import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Request, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { imageUploadOptions } from '../common/files/multer-image-options';
import { legacyRouteDescription, markLegacyResponse } from '../common/http/legacy-api';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('companies-legacy')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  private markDeprecated(res: Response) {
    markLegacyResponse(res);
  }

  @Post()
  @UseInterceptors(FileInterceptor('logo', imageUploadOptions(2 * 1024 * 1024)))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '[Deprecated] Crear una company', deprecated: true, description: legacyRouteDescription('/owners') })
  create(@Body() createCompanyDto: CreateCompanyDto, @Request() req, @Res({ passthrough: true }) res: Response, @UploadedFile() logo?: Express.Multer.File) {
    this.markDeprecated(res);
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para crear companies');
    }
    return this.companiesService.create(createCompanyDto, req.user.orgId, logo);
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
  @UseInterceptors(FileInterceptor('logo', imageUploadOptions(2 * 1024 * 1024)))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '[Deprecated] Actualizar una company', deprecated: true, description: legacyRouteDescription('/owners') })
  update(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto, @Request() req, @Res({ passthrough: true }) res: Response, @UploadedFile() logo?: Express.Multer.File) {
    this.markDeprecated(res);
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para actualizar companies');
    }
    return this.companiesService.update(id, updateCompanyDto, req.user.orgId, logo);
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
