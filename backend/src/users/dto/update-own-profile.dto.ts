import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateOwnProfileDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsEmail({}, { message: 'Email invalido' })
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  current_password?: string;

  @ApiProperty({ required: false })
  @IsString()
  @MinLength(6, { message: 'La nueva contrasena debe tener al menos 6 caracteres' })
  @IsOptional()
  new_password?: string;

  @ApiHideProperty()
  @IsEmpty({ message: 'avatar_url is no longer accepted; upload avatar file instead' })
  avatar_url?: string;
}
