import { IsOptional } from 'class-validator';

export class ServiceStatsQueryDto {
  @IsOptional()
  preset?: string;

  @IsOptional()
  startDate?: string;

  @IsOptional()
  endDate?: string;
}
