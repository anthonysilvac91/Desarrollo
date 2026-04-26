import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('customers-legacy')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('customers')
export class CustomersLegacyController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @ApiOperation({ summary: '[Legacy] Crear una company', description: 'Alias legacy. La ruta oficial es /companies.' })
  create(@Body() createCompanyDto: CreateCompanyDto, @Request() req) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para crear companies');
    }
    return this.companiesService.create(createCompanyDto, req.user.orgId);
  }

  @Get()
  @ApiOperation({ summary: '[Legacy] Obtener todas las companies de la organización', description: 'Alias legacy. La ruta oficial es /companies.' })
  findAll(@Request() req, @Query() query: PaginationQueryDto) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para listar companies');
    }
    return this.companiesService.findAll(req.user.orgId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '[Legacy] Obtener detalles de una company', description: 'Alias legacy. La ruta oficial es /companies.' })
  findOne(@Param('id') id: string, @Request() req) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para ver companies');
    }
    return this.companiesService.findOne(id, req.user.orgId);
  }

  @Patch(':id')
  @ApiOperation({ summary: '[Legacy] Actualizar una company', description: 'Alias legacy. La ruta oficial es /companies.' })
  update(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto, @Request() req) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para actualizar companies');
    }
    return this.companiesService.update(id, updateCompanyDto, req.user.orgId);
  }

  @Delete(':id')
  @ApiOperation({ summary: '[Legacy] Eliminar logicamente una company', description: 'Alias legacy. La ruta oficial es /companies.' })
  remove(@Param('id') id: string, @Request() req) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para eliminar companies');
    }
    return this.companiesService.remove(id, req.user.orgId);
  }
}
