import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterOrganizationDto {
  @ApiProperty({ description: 'Nombre de la organizacion.' })
  @IsString()
  @IsNotEmpty()
  organization_name: string;

  @ApiProperty({ description: 'Nombre completo del administrador inicial.' })
  @IsString()
  @IsNotEmpty()
  admin_name: string;

  @ApiProperty({ description: 'Correo del administrador inicial.' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Contrasena del administrador inicial (minimo 6 caracteres).' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'La contrasena requiere min. 6 caracteres' })
  password: string;
}
