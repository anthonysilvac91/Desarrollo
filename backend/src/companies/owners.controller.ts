import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { imageUploadOptions } from '../common/files/multer-image-options';
import { OwnersService } from './companies.service';
import { CreateOwnerDto } from './dto/create-company.dto';
import { UpdateOwnerDto } from './dto/update-company.dto';

@ApiTags('owners')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('owners')
export class OwnersController {
  constructor(private readonly companiesService: OwnersService) {}

  @Post()
  @UseInterceptors(FileInterceptor('logo', imageUploadOptions(2 * 1024 * 1024)))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Crear un owner' })
  create(@Body() createCompanyDto: CreateOwnerDto, @Request() req, @UploadedFile() logo?: Express.Multer.File) {
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
  update(@Param('id') id: string, @Body() updateCompanyDto: UpdateOwnerDto, @Request() req, @UploadedFile() logo?: Express.Multer.File) {
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
