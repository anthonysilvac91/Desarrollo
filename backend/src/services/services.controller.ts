import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request, ForbiddenException, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import { AuthGuard } from '../auth/auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Services')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar un servicio ejecutado', description: 'Crea el servicio y aplica visibilidad según la configuración de la organización.' })
  @UseInterceptors(FilesInterceptor('images', 10, {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
      }
    })
  }))
  create(@Body() createServiceDto: CreateServiceDto, @Request() req, @UploadedFiles() files: Express.Multer.File[]) {
    return this.servicesService.create(createServiceDto, req.user, files);
  }

  @Get()
  @ApiOperation({ summary: 'Listar historial de servicios', description: 'Dependiendo del rol que acceda y el param asset_id, devuelve todo o filtra los no públicos.' })
  findAll(@Query() query: ListServicesQueryDto, @Request() req) {
    return this.servicesService.findAll(query, req.user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar un Service (solo ADMIN)', description: 'Admite modificación de datos, status y visibilidad.' })
  update(@Param('id') id: string, @Body() updateServiceDto: UpdateServiceDto, @Request() req) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Solo un Admin puede editar los Services en esta fase MVP');
    }
    return this.servicesService.update(id, updateServiceDto, req.user.orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un servicio', description: 'Retorna el servicio con sus adjuntos, operario y activo relacionado.' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.servicesService.findOne(id, req.user);
  }
}
