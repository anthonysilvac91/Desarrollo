import { IsBoolean, IsEmpty, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { WorkerEditPolicy } from '@prisma/client';
import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrganizationSettingsDto {
  @ApiPropertyOptional({ description: 'Nombre de la organización.' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Indica si los Services creados se publican directamente al cliente.' })
  @IsBoolean()
  @IsOptional()
  auto_publish_services?: boolean;

  @ApiPropertyOptional({ enum: WorkerEditPolicy, description: 'Politica global para controlar si/cuando el Operario puede editar su Job.' })
  @IsEnum(WorkerEditPolicy)
  @IsOptional()
  worker_edit_policy?: WorkerEditPolicy;

  @ApiPropertyOptional({ description: 'Ventana en horas en caso de que utilice la policy respectiva.' })
  @IsNumber()
  @IsOptional()
  worker_edit_window_hours?: number;

  @ApiPropertyOptional({ description: 'Color primario de la marca (Hex).' })
  @IsString()
  @IsOptional()
  brand_color?: string;

  @ApiHideProperty()
  @IsEmpty({ message: 'logo_url is no longer accepted; upload logo file instead' })
  logo_url?: string;

  @ApiPropertyOptional({ description: 'Si es true, los workers tendran acceso restringido configurado por un admin en lugar de ver todos los assets.' })
  @IsBoolean()
  @IsOptional()
  worker_restricted_access?: boolean;

  @ApiPropertyOptional({ description: 'ID del icono por defecto para activos (yacht, car, etc.)' })
  @IsString()
  @IsOptional()
  default_asset_icon?: string;
}
