import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEmpty,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateOwnProfileDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsEmail({}, { message: 'Email invalido' })
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  current_password?: string;

  @ApiProperty({ required: false })
  @IsString()
  @MinLength(6, {
    message: 'La nueva contrasena debe tener al menos 6 caracteres',
  })
  @IsOptional()
  new_password?: string;

  @ApiProperty({
    required: false,
    description: 'Si es "true", elimina el avatar del usuario.',
  })
  @IsString()
  @IsOptional()
  remove_avatar?: string;

  @ApiHideProperty()
  @IsEmpty({
    message: 'avatar_url is no longer accepted; upload avatar file instead',
  })
  avatar_url?: string;

  @ApiPropertyOptional({
    enum: ['en', 'es'],
    description: 'Idioma del correo de confirmacion (segun el idioma activo en el cliente)',
  })
  @IsOptional()
  @IsIn(['en', 'es'])
  language?: 'en' | 'es';
}
