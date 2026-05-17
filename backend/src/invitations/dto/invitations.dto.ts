import { IsEmail, IsEmpty, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateInvitationDto {
  @ApiProperty({ description: 'Email del invitado.' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ enum: ['ADMIN', 'WORKER', 'EXTERNAL'], description: 'Rol del usuario. SUPER_ADMIN bloqueado.' })
  @IsIn(['ADMIN', 'WORKER', 'EXTERNAL'])
  @IsNotEmpty()
  role: Role;

  @ApiPropertyOptional({ description: 'Obligatorio si lo crea un SUPER_ADMIN. Ignorado si lo crea un ADMIN.' })
  @IsUUID()
  @IsOptional()
  organization_id?: string;

  @ApiHideProperty()
  @IsEmpty({ message: 'company_id is no longer accepted; use owner_id' })
  company_id?: string;

  @ApiPropertyOptional({ description: 'ID canonico del owner para la invitacion.' })
  @IsUUID()
  @IsOptional()
  owner_id?: string;

  @ApiHideProperty()
  @IsEmpty({ message: 'customer_id is no longer accepted; use owner_id' })
  customer_id?: string;
}

export class ValidateInvitationDto {
  @ApiProperty({ description: 'Token de 64 caracteres Hex enviado al correo.' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
