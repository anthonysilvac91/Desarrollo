import { IsOptional, IsUUID } from 'class-validator';

export class ListServicesQueryDto {
  @IsUUID()
  @IsOptional()
  asset_id?: string;
}
