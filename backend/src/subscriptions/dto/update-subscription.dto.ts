import { IsEnum, IsOptional, IsInt, IsNumber, IsBoolean, IsString, Min } from 'class-validator';
import { PlanTier } from '@prisma/client';

export class UpdateSubscriptionDto {
  @IsEnum(PlanTier)
  plan: PlanTier;

  @IsOptional()
  @IsInt()
  @Min(0)
  max_users?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  max_assets?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max_storage_gb?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max_video_hours?: number;

  @IsOptional()
  @IsBoolean()
  allow_external?: boolean;

  @IsOptional()
  @IsBoolean()
  allow_branding?: boolean;

  @IsOptional()
  @IsBoolean()
  allow_ai_translation?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSubscriptionStatusDto {
  @IsEnum(['ACTIVE', 'SUSPENDED'] as const)
  status: 'ACTIVE' | 'SUSPENDED';
}
