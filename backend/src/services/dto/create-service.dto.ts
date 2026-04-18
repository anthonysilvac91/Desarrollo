import { IsString, IsOptional, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateServiceDto {
  @ApiProperty({ description: 'ID UUID del activo al que pertenece el servicio', example: 'dca4d7d1-...' })
  @IsUUID()
  @IsNotEmpty()
  asset_id: string;

  @ApiProperty({ description: 'Título conciso descriptivo del servicio realizado', example: 'Sincronización de correas realizada' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Descripción adicional del operario', example: 'Falta un repuesto para el faro izquierdo.' })
  @IsString()
  @IsOptional()
  description?: string;
}
