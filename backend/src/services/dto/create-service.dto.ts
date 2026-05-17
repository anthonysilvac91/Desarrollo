import { IsString, IsOptional, IsNotEmpty, IsUUID, IsBoolean, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateServiceDto {
  @ApiProperty({ description: 'ID UUID del activo al que pertenece el servicio', example: 'dca4d7d1-...' })
  @IsUUID()
  @IsNotEmpty()
  asset_id: string;

  @ApiProperty({ description: 'Título conciso descriptivo del servicio realizado', example: 'Sincronización de correas realizada' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120, { message: 'El titulo no puede superar los 120 caracteres' })
  title: string;

  @ApiPropertyOptional({ description: 'Descripción adicional del operario', example: 'Falta un repuesto para el faro izquierdo.' })
  @IsString()
  @IsOptional()
  @MaxLength(400, { message: 'La descripcion no puede superar los 400 caracteres' })
  description?: string;

  @ApiPropertyOptional({ description: 'Indica si es visible para los clientes' })
  @IsOptional()
  @IsBoolean()
  is_public?: boolean;

  @ApiPropertyOptional({ description: 'Estado del servicio' })
  @IsOptional()
  @IsEnum(['COMPLETED', 'ARCHIVED'])
  status?: any;
}
