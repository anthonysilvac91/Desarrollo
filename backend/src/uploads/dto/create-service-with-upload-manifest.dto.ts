import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ExpectedAttachmentDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsString()
  @IsNotEmpty()
  sizeBytes: string;

  @IsEnum(['IMAGE', 'VIDEO', 'DOCUMENT'])
  mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
}

export class CreateServiceWithUploadManifestDto {
  @IsUUID()
  @IsNotEmpty()
  asset_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpectedAttachmentDto)
  expectedAttachments: ExpectedAttachmentDto[] = [];
}
