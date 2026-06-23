import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { SubscriptionsService } from './subscriptions.service';
import { UpdateSubscriptionDto, UpdateSubscriptionStatusDto } from './dto/update-subscription.dto';
import { RequestPlanChangeDto, ApprovePlanChangeDto } from './dto/request-plan-change.dto';
import { PlanTier, SubscriptionStatus } from '@prisma/client';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las suscripciones (SUPER_ADMIN)' })
  findAll(
    @Request() req,
    @Query('plan') plan?: PlanTier,
    @Query('status') status?: SubscriptionStatus,
  ) {
    if (req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Solo SUPER_ADMIN puede listar suscripciones');
    }
    return this.subscriptionsService.findAll({ plan, status });
  }

  @Get('me')
  @ApiOperation({ summary: 'Ver mi plan y uso actual' })
  findMyPlan(@Request() req) {
    if (!req.user.orgId) {
      throw new ForbiddenException('El usuario no pertenece a ninguna organización');
    }
    return this.subscriptionsService.findByOrg(req.user.orgId);
  }

  @Post(':orgId/plan')
  @ApiOperation({ summary: 'Asignar plan a una organización (SUPER_ADMIN)' })
  updatePlan(
    @Param('orgId') orgId: string,
    @Body() dto: UpdateSubscriptionDto,
    @Request() req,
  ) {
    if (req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Solo SUPER_ADMIN puede asignar planes');
    }
    const { plan, notes, ...overrides } = dto;
    const hasOverrides = Object.keys(overrides).length > 0;
    return this.subscriptionsService.updatePlan(
      orgId,
      plan,
      hasOverrides ? overrides : undefined,
      notes,
    );
  }

  @Post('me/request-change')
  @ApiOperation({ summary: 'Solicitar cambio de plan (ADMIN)' })
  requestPlanChange(@Body() dto: RequestPlanChangeDto, @Request() req) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Solo ADMIN puede solicitar cambio de plan');
    }
    return this.subscriptionsService.requestPlanChange(
      req.user.orgId,
      dto.requested_plan,
      req.user.id,
    );
  }

  @Post(':orgId/approve-change')
  @ApiOperation({ summary: 'Aprobar o rechazar solicitud de cambio (SUPER_ADMIN)' })
  approvePlanChange(
    @Param('orgId') orgId: string,
    @Body() dto: ApprovePlanChangeDto,
    @Request() req,
  ) {
    if (req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Solo SUPER_ADMIN puede aprobar cambios');
    }
    return this.subscriptionsService.approvePlanChange(orgId, dto.approved);
  }

  @Patch(':orgId/status')
  @ApiOperation({ summary: 'Suspender o reactivar suscripción (SUPER_ADMIN)' })
  toggleStatus(
    @Param('orgId') orgId: string,
    @Body() dto: UpdateSubscriptionStatusDto,
    @Request() req,
  ) {
    if (req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Solo SUPER_ADMIN puede cambiar estado');
    }
    return this.subscriptionsService.toggleStatus(orgId, dto.status);
  }
}
