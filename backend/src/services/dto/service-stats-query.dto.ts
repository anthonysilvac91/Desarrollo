import { IsOptional, IsUUID } from 'class-validator';

export class ServiceStatsQueryDto {
  @IsUUID()
  @IsOptional()
  asset_id?: string;

  @IsUUID()
  @IsOptional()
  worker_id?: string;

  @IsOptional()
  preset?: string;

  @IsOptional()
  startDate?: string;

  @IsOptional()
  endDate?: string;
}
