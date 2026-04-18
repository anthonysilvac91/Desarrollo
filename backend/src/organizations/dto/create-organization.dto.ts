import { IsString, IsNotEmpty, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @ApiProperty({ description: 'Nombre de la organización.' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Identificador URL único (ej: marina-azul).' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ description: 'Email del administrador inicial que recibirá la invitación.' })
  @IsEmail()
  @IsNotEmpty()
  admin_email: string;
}
