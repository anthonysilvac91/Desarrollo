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
}
