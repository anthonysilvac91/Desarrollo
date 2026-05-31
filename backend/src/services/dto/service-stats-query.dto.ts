import { IsOptional } from 'class-validator';

export class ServiceStatsQueryDto {
  @IsOptional()
  startDate?: string;

  @IsOptional()
  endDate?: string;
}
