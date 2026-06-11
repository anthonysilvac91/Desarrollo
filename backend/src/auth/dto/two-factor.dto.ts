import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyTwoFactorSetupDto {
  @ApiProperty({ description: 'Token temporal emitido por /auth/2fa/setup.' })
  @IsString()
  @IsNotEmpty()
  setup_token: string;

  @ApiProperty({ description: 'Codigo TOTP de 6 digitos.' })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class LoginTwoFactorDto {
  @ApiProperty({ description: 'Token temporal emitido por /auth/login cuando 2FA esta activo.' })
  @IsString()
  @IsNotEmpty()
  temporary_token: string;

  @ApiProperty({ description: 'Codigo TOTP de 6 digitos o codigo de recuperacion.' })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class DisableTwoFactorDto {
  @ApiPropertyOptional({ description: 'Codigo TOTP o backup code. Requerido si 2FA esta activo.' })
  @IsString()
  @IsOptional()
  code?: string;
}

export class RequestTwoFactorEmailDto {
  @ApiProperty({ description: 'Token temporal emitido por /auth/login cuando 2FA esta activo.' })
  @IsString()
  @IsNotEmpty()
  temporary_token: string;
}

export class LoginTwoFactorEmailDto {
  @ApiProperty({ description: 'Token temporal emitido por /auth/login.' })
  @IsString()
  @IsNotEmpty()
  temporary_token: string;

  @ApiProperty({ description: 'Codigo enviado al correo electronico.' })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class VerifyTwoFactorEmailSetupDto {
  @ApiProperty({ description: 'Codigo enviado al correo para activar 2FA.' })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class DisableTwoFactorEmailDto {
  @ApiProperty({ description: 'Codigo enviado al correo para desactivar 2FA.' })
  @IsString()
  @IsNotEmpty()
  code: string;
}
