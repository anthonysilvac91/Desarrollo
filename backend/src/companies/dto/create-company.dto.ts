import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateOwnerDto {
  @ApiProperty({ description: 'Nombre del owner.' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  name: string;

  @ApiProperty({ description: 'Estado activo/inactivo del owner.', required: false })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiProperty({ description: 'URL del logo del owner.', required: false })
  @IsString()
  @IsOptional()
  logo_url?: string;
}
