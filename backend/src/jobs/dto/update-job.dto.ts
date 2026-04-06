import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateJobDto } from './create-job.dto';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { JobStatus } from '@prisma/client';

export class UpdateJobDto extends PartialType(CreateJobDto) {
  @ApiPropertyOptional({ description: 'Cambia la visibilidad forzada hacia el cliente' })
  @IsBoolean()
  @IsOptional()
  is_public?: boolean;

  @ApiPropertyOptional({ enum: JobStatus, description: 'COMPLETED o ARCHIVED' })
  @IsEnum(JobStatus)
  @IsOptional()
  status?: JobStatus;
}
