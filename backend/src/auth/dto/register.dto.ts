import {
  IsEmpty,
  IsString,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsUUID,
} from 'class-validator';
import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

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

  @ApiHideProperty()
  @IsEmpty({ message: 'company_id is no longer accepted; use owner_id' })
  company_id?: string;

  @ApiPropertyOptional({
    description: 'ID canonico del owner para el registro.',
  })
  @IsUUID()
  @IsOptional()
  owner_id?: string;

  @ApiHideProperty()
  @IsEmpty({ message: 'customer_id is no longer accepted; use owner_id' })
  customer_id?: string;
}
