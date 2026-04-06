import { IsBoolean, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { WorkerEditPolicy } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrganizationSettingsDto {
  @ApiPropertyOptional({ description: 'Indica si los Jobs creados se publican directamente al cliente.' })
  @IsBoolean()
  @IsOptional()
  auto_publish_jobs?: boolean;

  @ApiPropertyOptional({ enum: WorkerEditPolicy, description: 'Política global para controlar si/cuándo el Operario puede editar su Job.' })
  @IsEnum(WorkerEditPolicy)
  @IsOptional()
  worker_edit_policy?: WorkerEditPolicy;

  @ApiPropertyOptional({ description: 'Ventana en horas en caso de que utilice la policy respectiva.' })
  @IsNumber()
  @IsOptional()
  worker_edit_window_hours?: number;
}
