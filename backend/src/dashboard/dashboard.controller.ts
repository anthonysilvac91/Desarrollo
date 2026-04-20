import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '../auth/auth.guard';
import { DashboardStatsDto } from './dto/dashboard.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener métricas del dashboard (Solo ADMIN/SUPER_ADMIN)' })
  @ApiQuery({ name: 'organizationId', required: false, description: 'Filtro opcional solo permitido para SUPER_ADMIN' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiResponse({ type: DashboardStatsDto })
  getStats(
    @Query('organizationId') organizationId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req: any
  ) {
    return this.dashboardService.getStats(
      { id: req.user.id, role: req.user.role, orgId: req.user.orgId },
      organizationId,
      { startDate, endDate }
    );
  }
}
