import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service';

@ApiTags('Public Service Shares')
@Controller('public/service-shares')
export class ServiceSharesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Obtener vista publica de un servicio compartido' })
  getPublicSharedService(@Param('token') token: string) {
    return this.servicesService.getPublicSharedService(token);
  }
}
