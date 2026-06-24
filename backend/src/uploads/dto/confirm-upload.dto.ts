import { IsOptional, IsString } from 'class-validator';

export class ConfirmUploadDto {
  @IsOptional()
  @IsString()
  tusUploadUrl?: string;
}
