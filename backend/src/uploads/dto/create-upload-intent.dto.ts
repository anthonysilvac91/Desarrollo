import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateUploadIntentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  originalName: string;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsString()
  @IsNotEmpty()
  sizeBytes: string;

  @IsEnum(['IMAGE', 'VIDEO', 'DOCUMENT'])
  mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
}
