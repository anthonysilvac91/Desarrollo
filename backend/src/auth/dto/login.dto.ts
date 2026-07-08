import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@test.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({
    enum: ['en', 'es'],
    description: 'Idioma para correos de seguridad (segun el idioma activo en el cliente)',
  })
  @IsOptional()
  @IsIn(['en', 'es'])
  language?: 'en' | 'es';
}
