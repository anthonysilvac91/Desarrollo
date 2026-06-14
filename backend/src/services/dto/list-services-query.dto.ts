import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListServicesQueryDto extends PaginationQueryDto {
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

  @IsIn(['es', 'en'])
  @IsOptional()
  lang?: string;
}
