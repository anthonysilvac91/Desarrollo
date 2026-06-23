import { IsEnum, IsBoolean } from 'class-validator';
import { PlanTier } from '@prisma/client';

export class RequestPlanChangeDto {
  @IsEnum(PlanTier)
  requested_plan: PlanTier;
}

export class ApprovePlanChangeDto {
  @IsBoolean()
  approved: boolean;
}
