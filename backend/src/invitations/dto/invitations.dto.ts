import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateInvitationDto {
  @ApiProperty({ description: 'Email del invitado.' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ enum: ['ADMIN', 'WORKER', 'CLIENT', 'EXTERNAL'], description: 'Rol del usuario. SUPER_ADMIN bloqueado.' })
  @IsIn(['ADMIN', 'WORKER', 'CLIENT', 'EXTERNAL'])
  @IsNotEmpty()
  role: Role | 'EXTERNAL';

  @ApiPropertyOptional({ description: 'Obligatorio si lo crea un SUPER_ADMIN. Ignorado si lo crea un ADMIN.' })
  @IsUUID()
  @IsOptional()
  organization_id?: string;

  @ApiPropertyOptional({ description: 'Alias legacy de owner_id para la invitacion.' })
  @IsUUID()
  @IsOptional()
  company_id?: string;

  @ApiPropertyOptional({ description: 'ID canonico del owner para la invitacion.' })
  @IsUUID()
  @IsOptional()
  owner_id?: string;

  @ApiPropertyOptional({ description: 'Alias legacy de owner_id.' })
  @IsUUID()
  @IsOptional()
  customer_id?: string;
}

export class ValidateInvitationDto {
  @ApiProperty({ description: 'Token de 64 caracteres Hex enviado al correo.' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
