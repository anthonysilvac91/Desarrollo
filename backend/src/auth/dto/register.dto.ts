import { IsString, IsNotEmpty, MinLength, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: 'Token de invitación.' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ description: 'Nombre completo.' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Contraseña (mínimo 6 caracteres).' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'La contraseña requiere min. 6 caracteres' })
  password: string;

  @ApiPropertyOptional({ description: 'ID legacy de company requerido para registros CLIENT/EXTERNAL.' })
  @IsUUID()
  @IsOptional()
  company_id?: string;

  @ApiPropertyOptional({ description: 'Alias temporal de company_id para futuras llamadas con owner_id.' })
  @IsUUID()
  @IsOptional()
  owner_id?: string;
}
