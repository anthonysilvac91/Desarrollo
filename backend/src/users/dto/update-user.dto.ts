import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEmpty, IsOptional, IsString, IsUrl, IsUUID } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({ required: false, description: 'Alias legacy de owner_id.' })
  @IsEmail({}, { message: 'Email invalido' })
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false, description: 'Alias legacy de owner_id.' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false })
  @IsUrl({}, { message: 'Avatar URL invalido' })
  @IsOptional()
  avatar_url?: string;

  @ApiProperty({ required: false })
  @IsUUID('4', { message: 'ID de organizacion invalido' })
  @IsOptional()
  organization_id?: string;

  @ApiHideProperty()
  @IsEmpty({ message: 'company_id is no longer accepted; use owner_id' })
  company_id?: string;

  @ApiProperty({ required: false })
  @IsUUID('4', { message: 'ID de owner invalido' })
  @IsOptional()
  owner_id?: string;

  @ApiHideProperty()
  @IsEmpty({ message: 'customer_id is no longer accepted; use owner_id' })
  customer_id?: string;
}
