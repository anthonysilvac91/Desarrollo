import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ServicesService } from './services.service';

@ApiTags('Public Service Shares')
@Controller('public/service-shares')
export class ServiceSharesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Obtener vista publica de un servicio compartido' })
  getPublicSharedService(@Param('token') token: string, @Query('lang') lang?: string) {
    return this.servicesService.getPublicSharedService(token, lang);
  }

  @Get(':token/photos.zip')
  @ApiOperation({ summary: 'Descargar fotos de un servicio compartido en ZIP' })
  async downloadPhotosZip(@Param('token') token: string, @Req() req: Request, @Res() res: Response) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const { fileName, buffer } = await this.servicesService.generateSharedServicePhotosZip(token, baseUrl);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @Get(':token/report.pdf')
  @ApiOperation({ summary: 'Descargar reporte PDF de un servicio compartido' })
  async downloadReportPdf(@Param('token') token: string, @Res() res: Response) {
    const { fileName, buffer } = await this.servicesService.generateSharedServiceReportPdf(token);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }
}
