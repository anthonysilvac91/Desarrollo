import { IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleTemplateDto {
  @ApiProperty({ description: 'true para habilitar, false para deshabilitar.' })
  @IsBoolean()
  @IsNotEmpty()
  enabled: boolean;
}
