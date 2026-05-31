import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class AssetQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  owner_id?: string;

  @IsOptional()
  @IsString()
  is_active?: string;
}
