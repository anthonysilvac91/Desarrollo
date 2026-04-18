import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
}
