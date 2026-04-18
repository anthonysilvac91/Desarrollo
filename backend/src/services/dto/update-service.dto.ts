import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateServiceDto } from './create-service.dto';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ServiceStatus } from '@prisma/client';

export class UpdateServiceDto extends PartialType(CreateServiceDto) {
  @ApiPropertyOptional({ description: 'Cambia la visibilidad del servicio hacia el cliente' })
  @IsBoolean()
  @IsOptional()
  is_public?: boolean;

  @ApiPropertyOptional({ enum: ServiceStatus, description: 'COMPLETED o ARCHIVED' })
  @IsEnum(ServiceStatus)
  @IsOptional()
  status?: ServiceStatus;
}
