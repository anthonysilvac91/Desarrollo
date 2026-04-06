import { Controller, Patch, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';
import { AuthGuard } from '../auth/auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgService: OrganizationsService) {}

  @Patch('settings')
  @ApiOperation({ summary: 'Actualizar parámetros de la Organización (Solo Admin)' })
  updateSettings(@Body() dto: UpdateOrganizationSettingsDto, @Request() req) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Solo ADMIN puede cambiar configuraciones');
    return this.orgService.updateSettings(req.user.orgId, dto);
  }
}
