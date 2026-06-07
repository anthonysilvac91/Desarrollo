import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateAssetDto {
  @ApiPropertyOptional({ example: 'Generador Alpha-1', description: 'Nombre del activo.' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Descripción del activo.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Categoría del activo.' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Ubicación textual o coordenadas.' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ description: 'Número de serie o matrícula.' })
  @IsString()
  @IsOptional()
  serial_number?: string;

  @ApiPropertyOptional({ description: 'ID del owner asignado al activo.' })
  @IsString()
  @IsOptional()
  owner_id?: string;

  // Campos bloqueados (legado)
  @ApiHideProperty()
  @IsEmpty({ message: 'thumbnail_url is no longer accepted; upload thumbnail file instead' })
  thumbnail_url?: string;

  @ApiHideProperty()
  @IsEmpty({ message: 'company_id is no longer accepted; use owner_id' })
  company_id?: string;

  @ApiHideProperty()
  @IsEmpty({ message: 'customer_id is no longer accepted; use owner_id' })
  customer_id?: string;

  // organization_id, thumbnail_file_id, id, created_at, updated_at
  // no se declaran aquí: ValidationPipe(whitelist:true) los eliminará automáticamente
}
