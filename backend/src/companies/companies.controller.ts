import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('companies')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('logo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Crear una company' })
  create(@Body() createCompanyDto: CreateCompanyDto, @Request() req, @UploadedFile() logo?: Express.Multer.File) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para crear companies');
    }
    return this.companiesService.create(createCompanyDto, req.user.orgId, logo);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las companies de la organización' })
  findAll(@Request() req, @Query() query: PaginationQueryDto) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para listar companies');
    }
    return this.companiesService.findAll(req.user.orgId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalles de una company' })
  findOne(@Param('id') id: string, @Request() req) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para ver companies');
    }
    return this.companiesService.findOne(id, req.user.orgId);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('logo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Actualizar una company' })
  update(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto, @Request() req, @UploadedFile() logo?: Express.Multer.File) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para actualizar companies');
    }
    return this.companiesService.update(id, updateCompanyDto, req.user.orgId, logo);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar logicamente una company' })
  remove(@Param('id') id: string, @Request() req) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para eliminar companies');
    }
    return this.companiesService.remove(id, req.user.orgId);
  }
}
