import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAssetDto {
  @ApiProperty({ example: 'Generador Alpha-1', description: 'El nombre identificador de la unidad técnica/inmueble/embarcación' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Sector B', description: 'Información accesoria del activo.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Categoría del activo (ej: boat, car, machinery).' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Ubicación textual o coordenadas.' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ description: 'URL de la foto principal del activo.' })
  @IsString()
  @IsOptional()
  thumbnail_url?: string;

  @ApiPropertyOptional({ description: 'Número de serie o matrícula.' })
  @IsString()
  @IsOptional()
  serial_number?: string;

  @ApiPropertyOptional({ description: 'ID de la empresa cliente asignada al activo.' })
  @IsString()
  @IsOptional()
  customer_id?: string;

  @ApiPropertyOptional({ description: 'ID de la organización (opcional, defaults a la del usuario).' })
  @IsString()
  @IsOptional()
  organization_id?: string;
}

