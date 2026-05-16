import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ description: 'Correo electronico unico' })
  @IsEmail({}, { message: 'Email invalido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  email: string;

  @ApiProperty({ description: 'Contrasena (minimo 8 caracteres)' })
  @IsString()
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres' })
  @IsNotEmpty({ message: 'La contrasena es requerida' })
  password: string;

  @ApiProperty({ description: 'Nombre completo' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  name: string;

  @ApiProperty({ enum: ['SUPER_ADMIN', 'ADMIN', 'WORKER', 'CLIENT', 'EXTERNAL'], description: 'Rol del usuario' })
  @IsIn(['SUPER_ADMIN', 'ADMIN', 'WORKER', 'CLIENT', 'EXTERNAL'], { message: 'Rol invalido' })
  @IsNotEmpty({ message: 'El rol es requerido' })
  role: Role | 'EXTERNAL';

  @ApiProperty({ required: false, description: 'ID de la organizacion (Opcional para SUPER_ADMIN)' })
  @IsOptional()
  @IsUUID('4', { message: 'ID de organizacion invalido' })
  organization_id?: string;

  @ApiProperty({ required: false, description: 'ID legacy de company asociada' })
  @IsOptional()
  @IsUUID('4', { message: 'ID de company invalido' })
  company_id?: string;

  @ApiProperty({ required: false, description: 'ID canonico del owner asociado' })
  @IsOptional()
  @IsUUID('4', { message: 'ID de owner invalido' })
  owner_id?: string;

  @ApiProperty({ required: false, description: 'Alias legacy de company_id' })
  @IsOptional()
  @IsUUID('4', { message: 'ID de customer invalido' })
  customer_id?: string;
}
