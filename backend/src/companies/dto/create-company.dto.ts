import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmpty, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateOwnerDto {
  @ApiProperty({ description: 'Nombre del owner.' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  name: string;

  @ApiProperty({ description: 'Estado activo/inactivo del owner.', required: false })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiHideProperty()
  @IsEmpty({ message: 'logo_url is no longer accepted; upload logo file instead' })
  logo_url?: string;
}
