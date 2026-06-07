import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ServiceStatus } from '@prisma/client';

export class UpdateServiceDto {
  @ApiPropertyOptional({ description: 'Título del servicio.' })
  @IsString()
  @IsOptional()
  @MaxLength(120, { message: 'El titulo no puede superar los 120 caracteres' })
  title?: string;

  @ApiPropertyOptional({ description: 'Descripción del servicio.' })
  @IsString()
  @IsOptional()
  @MaxLength(2000, { message: 'La descripcion no puede superar los 2000 caracteres' })
  description?: string;

  @ApiPropertyOptional({ description: 'Visibilidad hacia el cliente.' })
  @IsBoolean()
  @IsOptional()
  is_public?: boolean;

  @ApiPropertyOptional({ enum: ServiceStatus, description: 'COMPLETED o ARCHIVED' })
  @IsEnum(ServiceStatus)
  @IsOptional()
  status?: ServiceStatus;

  // asset_id excluido deliberadamente: un servicio no puede reasignarse a otro activo.
  // organization_id, worker_id, id, created_at, updated_at nunca son editables.
  // ValidationPipe(whitelist:true) elimina cualquier campo no declarado aquí.
}
