import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsEnum, IsOptional, IsString, MinLength, IsUUID } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ description: 'Correo electrónico único' })
  @IsEmail({}, { message: 'Email inválido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  email: string;

  @ApiProperty({ description: 'Contraseña (mínimo 8 caracteres)' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  password: string;

  @ApiProperty({ description: 'Nombre completo' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  name: string;

  @ApiProperty({ enum: Role, description: 'Rol del usuario' })
  @IsEnum(Role, { message: 'Rol inválido' })
  @IsNotEmpty({ message: 'El rol es requerido' })
  role: Role;

  @ApiProperty({ required: false, description: 'ID de la organización (Opcional para SUPER_ADMIN)' })
  @IsOptional()
  @IsUUID('4', { message: 'ID de organización inválido' })
  organization_id?: string;

  @ApiProperty({ required: false, description: 'ID de la company asociada (Opcional, solo si el rol es CLIENT)' })
  @IsOptional()
  @IsUUID('4', { message: 'ID de cliente inválido' })
  company_id?: string;
}
