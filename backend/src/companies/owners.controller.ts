import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { imageUploadOptions } from '../common/files/multer-image-options';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('owners')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('owners')
export class OwnersController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('logo', imageUploadOptions(2 * 1024 * 1024)))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Crear un owner' })
  create(@Body() createCompanyDto: CreateCompanyDto, @Request() req, @UploadedFile() logo?: Express.Multer.File) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para crear owners');
    }
    return this.companiesService.create(createCompanyDto, req.user.orgId, logo);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los owners de la organizacion' })
  findAll(@Request() req, @Query() query: PaginationQueryDto) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para listar owners');
    }
    return this.companiesService.findAll(req.user.orgId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalles de un owner' })
  findOne(@Param('id') id: string, @Request() req) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para ver owners');
    }
    return this.companiesService.findOne(id, req.user.orgId);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('logo', imageUploadOptions(2 * 1024 * 1024)))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Actualizar un owner' })
  update(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto, @Request() req, @UploadedFile() logo?: Express.Multer.File) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para actualizar owners');
    }
    return this.companiesService.update(id, updateCompanyDto, req.user.orgId, logo);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar logicamente un owner' })
  remove(@Param('id') id: string, @Request() req) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para eliminar owners');
    }
    return this.companiesService.remove(id, req.user.orgId);
  }
}
