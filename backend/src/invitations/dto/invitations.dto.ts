import {
  IsArray,
  IsEmail,
  IsEmpty,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { AssetAccessMode, Role } from '@prisma/client';

export class CreateInvitationDto {
  @ApiProperty({ description: 'Email del invitado.' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    enum: ['ADMIN', 'WORKER', 'EXTERNAL'],
    description: 'Rol del usuario. SUPER_ADMIN bloqueado.',
  })
  @IsIn(['ADMIN', 'WORKER', 'EXTERNAL'])
  @IsNotEmpty()
  role: Role;

  @ApiPropertyOptional({
    description:
      'Obligatorio si lo crea un SUPER_ADMIN. Ignorado si lo crea un ADMIN.',
  })
  @IsUUID()
  @IsOptional()
  organization_id?: string;

  @ApiHideProperty()
  @IsEmpty({ message: 'company_id is no longer accepted; use owner_id' })
  company_id?: string;

  @ApiPropertyOptional({
    description: 'ID canonico del owner para la invitacion.',
  })
  @IsUUID()
  @IsOptional()
  owner_id?: string;

  @ApiHideProperty()
  @IsEmpty({ message: 'customer_id is no longer accepted; use owner_id' })
  customer_id?: string;

  @ApiPropertyOptional({
    enum: AssetAccessMode,
    description:
      'Solo aplica si role es WORKER. UNRESTRICTED (default) vera todos los assets de la org.',
  })
  @IsOptional()
  @IsIn(['UNRESTRICTED', 'RESTRICTED'])
  asset_access_mode?: AssetAccessMode;

  @ApiPropertyOptional({
    type: [String],
    description:
      'IDs de activos a preasignar cuando asset_access_mode es RESTRICTED. Se aplican cuando la invitacion es aceptada.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  asset_ids?: string[];

  @ApiPropertyOptional({
    enum: ['en', 'es'],
    description: 'Idioma del correo de invitacion (segun el idioma activo en el cliente)',
  })
  @IsOptional()
  @IsIn(['en', 'es'])
  language?: 'en' | 'es';
}

export class ValidateInvitationDto {
  @ApiProperty({ description: 'Token de 64 caracteres Hex enviado al correo.' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
