import { IsEmail, IsIn, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendTestEmailDto {
  @ApiProperty({ description: 'Casilla de correo donde se enviara la prueba.' })
  @IsEmail()
  @IsNotEmpty()
  to: string;

  @ApiPropertyOptional({ enum: ['en', 'es'] })
  @IsOptional()
  @IsIn(['en', 'es'])
  lang?: 'en' | 'es';
}
