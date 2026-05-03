import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUrl, IsUUID } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({ required: false })
  @IsEmail({}, { message: 'Email inválido' })
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false })
  @IsUrl({}, { message: 'Avatar URL inválido' })
  @IsOptional()
  avatar_url?: string;

  @ApiProperty({ required: false })
  @IsUUID('4', { message: 'ID de organizaciÃ³n invÃ¡lido' })
  @IsOptional()
  organization_id?: string;

  @ApiProperty({ required: false })
  @IsUUID('4', { message: 'ID de cliente invÃ¡lido' })
  @IsOptional()
  company_id?: string;
}
