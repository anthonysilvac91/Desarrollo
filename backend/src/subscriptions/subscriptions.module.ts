import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitGuard } from './check-plan-limit.guard';

@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, PrismaService, PlanLimitGuard],
  exports: [SubscriptionsService, PlanLimitGuard],
})
export class SubscriptionsModule {}
