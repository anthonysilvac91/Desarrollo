import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class OwnerQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  is_active?: string;
}
