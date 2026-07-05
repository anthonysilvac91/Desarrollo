import { ApiProperty } from '@nestjs/swagger';
import { ApiHideProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEmpty,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { AssetAccessMode, Role } from '@prisma/client';

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

  @ApiProperty({
    enum: ['SUPER_ADMIN', 'ADMIN', 'WORKER', 'EXTERNAL'],
    description:
      'Rol del usuario. EXTERNAL es el rol canónico para usuarios externos.',
  })
  @IsIn(['SUPER_ADMIN', 'ADMIN', 'WORKER', 'EXTERNAL'], {
    message: 'Rol invalido',
  })
  @IsNotEmpty({ message: 'El rol es requerido' })
  role: Role;

  @ApiProperty({
    required: false,
    description: 'ID de la organizacion (Opcional para SUPER_ADMIN)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'ID de organizacion invalido' })
  organization_id?: string;

  @ApiHideProperty()
  @IsEmpty({ message: 'company_id is no longer accepted; use owner_id' })
  company_id?: string;

  @ApiProperty({
    required: false,
    description: 'ID canonico del owner asociado',
  })
  @IsOptional()
  @IsUUID('4', { message: 'ID de owner invalido' })
  owner_id?: string;

  @ApiHideProperty()
  @IsEmpty({ message: 'customer_id is no longer accepted; use owner_id' })
  customer_id?: string;

  @ApiProperty({
    required: false,
    enum: AssetAccessMode,
    description:
      'Solo aplica a WORKER. UNRESTRICTED (default) ve todos los assets de la org; RESTRICTED solo ve los asignados via /users/:id/asset-access.',
  })
  @IsOptional()
  @IsIn(['UNRESTRICTED', 'RESTRICTED'], { message: 'Modo de acceso invalido' })
  asset_access_mode?: AssetAccessMode;
}
