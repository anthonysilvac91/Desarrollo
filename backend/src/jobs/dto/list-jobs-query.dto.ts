import { IsOptional, IsUUID } from 'class-validator';

export class ListJobsQueryDto {
  @IsUUID()
  @IsOptional()
  asset_id?: string;
}
