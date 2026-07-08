import { IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token recibido por correo.' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ description: 'Nueva contraseña (mínimo 6 caracteres).' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'La contraseña requiere mínimo 6 caracteres' })
  password: string;

  @ApiPropertyOptional({
    enum: ['en', 'es'],
    description: 'Idioma del correo de confirmacion (segun el idioma activo en el cliente)',
  })
  @IsOptional()
  @IsIn(['en', 'es'])
  language?: 'en' | 'es';
}
