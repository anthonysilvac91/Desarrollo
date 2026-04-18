import { IsString, IsNotEmpty, IsEmail, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateInvitationDto {
  @ApiProperty({ description: 'Email del invitado.' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ enum: ['ADMIN', 'WORKER', 'CLIENT'], description: 'Rol que tendrá el usuario. SUPER_ADMIN bloqueado.' })
  @IsEnum(['ADMIN', 'WORKER', 'CLIENT'])
  @IsNotEmpty()
  role: Role;

  @ApiPropertyOptional({ description: 'Obligatorio si lo crea un SUPER_ADMIN. Ignorado si lo crea un ADMIN.' })
  @IsUUID()
  @IsOptional()
  organization_id?: string;
}

export class ValidateInvitationDto {
  @ApiProperty({ description: 'Token de 64 caracteres Hex enviado al correo.' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
