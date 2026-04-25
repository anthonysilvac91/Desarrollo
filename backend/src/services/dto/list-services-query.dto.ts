import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListServicesQueryDto extends PaginationQueryDto {
  @IsUUID()
  @IsOptional()
  asset_id?: string;

  @IsOptional()
  startDate?: string;

  @IsOptional()
  endDate?: string;
}
