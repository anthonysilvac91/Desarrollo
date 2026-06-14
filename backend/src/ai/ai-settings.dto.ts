import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOpenAiSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  api_key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;

  @IsOptional()
  @IsBoolean()
  translations_enabled?: boolean;

  @IsOptional()
  @IsDateString()
  translate_services_created_after?: string | null;
}
