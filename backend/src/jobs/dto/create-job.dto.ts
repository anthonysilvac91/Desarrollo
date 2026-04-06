import { IsString, IsOptional, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateJobDto {
  @ApiProperty({ description: 'ID UUID del activo recuperado', example: 'dca4d7d1-...' })
  @IsUUID()
  @IsNotEmpty()
  asset_id: string;

  @ApiProperty({ description: 'Título conciso descriptivo del trabajo realizado', example: 'Sincronización de correas realizadas' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Cuerpo de texto adicional del operario', example: 'Falta un repuesto para el faro izquierdo.' })
  @IsString()
  @IsOptional()
  description?: string;
}
