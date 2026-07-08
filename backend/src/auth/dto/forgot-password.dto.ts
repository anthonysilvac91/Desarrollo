import { IsEmail, IsIn, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'usuario@empresa.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    required: false,
    enum: ['en', 'es'],
    description: 'Idioma del correo de recuperación (según el idioma activo en el cliente)',
  })
  @IsOptional()
  @IsIn(['en', 'es'])
  language?: 'en' | 'es';
}
