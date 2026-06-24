import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Delete,
  Param,
} from '@nestjs/common';
import { AuthRequestContext, AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
  DisableTwoFactorDto,
  LoginTwoFactorDto,
  VerifyTwoFactorSetupDto,
  RequestTwoFactorEmailDto,
  LoginTwoFactorEmailDto,
  VerifyTwoFactorEmailSetupDto,
  DisableTwoFactorEmailDto,
} from './dto/two-factor.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from './auth.guard';
import { Throttle, SkipThrottle } from '@nestjs/throttler';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  private firstHeader(value: any): string | undefined {
    if (Array.isArray(value)) return value[0];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private getRequestContext(req: any): AuthRequestContext {
    const forwardedFor = this.firstHeader(req.headers?.['x-forwarded-for']);
    const ipFromForwarded = forwardedFor?.split(',')[0]?.trim();

    return {
      userAgent: this.firstHeader(req.headers?.['user-agent']),
      ipAddress:
        ipFromForwarded ||
        this.firstHeader(req.headers?.['x-real-ip']) ||
        req.ip ||
        req.socket?.remoteAddress,
      country:
        this.firstHeader(req.headers?.['x-vercel-ip-country']) ||
        this.firstHeader(req.headers?.['cf-ipcountry']),
      region:
        this.firstHeader(req.headers?.['x-vercel-ip-country-region']) ||
        this.firstHeader(req.headers?.['x-vercel-ip-region']),
      city:
        this.firstHeader(req.headers?.['x-vercel-ip-city']) ||
        this.firstHeader(req.headers?.['cf-ipcity']),
    };
  }

  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Generar token por Tenant' })
  @ApiResponse({ status: 201, description: 'Retorna JWT `access_token`' })
  login(@Body() loginDto: LoginDto, @Request() req) {
    return this.authService.login(loginDto, this.getRequestContext(req));
  }

  @Post('register')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Registro mediante token de invitación' })
  register(@Body() registerDto: RegisterDto, @Request() req) {
    return this.authService.register(registerDto, this.getRequestContext(req));
  }

  @Post('register-organization')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({
    summary: 'Crear una organizacion nueva y su administrador inicial',
  })
  registerOrganization(@Body() dto: RegisterOrganizationDto, @Request() req) {
    return this.authService.registerOrganization(
      dto,
      this.getRequestContext(req),
    );
  }

  @Post('forgot-password')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Solicitar enlace de recuperación de contraseña' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Restablecer contraseña con token del correo' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('2fa/login')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Completar login con 2FA' })
  loginWithTwoFactor(@Body() dto: LoginTwoFactorDto, @Request() req) {
    return this.authService.loginWithTwoFactor(
      dto.temporary_token,
      dto.code,
      this.getRequestContext(req),
    );
  }

  @Get('sessions')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar sesiones activas del usuario actual' })
  getSessions(@Request() req) {
    return this.authService.getSessions(req.user.id, req.user.session_id);
  }

  @Delete('sessions/:id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar una sesion activa del usuario actual' })
  revokeSession(@Request() req, @Param('id') sessionId: string) {
    return this.authService.revokeSession(
      req.user.id,
      sessionId,
      req.user.session_id,
    );
  }

  @Post('sessions/revoke-others')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cerrar todas las demas sesiones del usuario actual',
  })
  revokeOtherSessions(@Request() req) {
    return this.authService.revokeOtherSessions(
      req.user.id,
      req.user.session_id,
    );
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar la sesion actual' })
  logout(@Request() req) {
    return this.authService.logout(req.user.id, req.user.session_id);
  }

  @Get('2fa/status')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener estado 2FA del usuario actual' })
  getTwoFactorStatus(@Request() req) {
    return this.authService.getTwoFactorStatus(req.user.id);
  }

  @Post('2fa/setup')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Iniciar configuracion TOTP para app autenticadora',
  })
  setupTwoFactor(@Request() req) {
    return this.authService.setupTwoFactor(req.user.id);
  }

  @Post('2fa/verify-setup')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirmar configuracion TOTP y activar 2FA' })
  verifyTwoFactorSetup(@Request() req, @Body() dto: VerifyTwoFactorSetupDto) {
    return this.authService.verifyTwoFactorSetup(
      req.user.id,
      dto.setup_token,
      dto.code,
    );
  }

  @Post('2fa/disable')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desactivar 2FA del usuario actual' })
  disableTwoFactor(@Request() req, @Body() dto: DisableTwoFactorDto) {
    return this.authService.disableTwoFactor(req.user.id, dto.code);
  }

  @Post('2fa/email/send-code')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Enviar codigo 2FA al correo del usuario autenticado',
  })
  sendTwoFactorEmailCode(@Request() req) {
    return this.authService.sendTwoFactorEmailCode(req.user.id);
  }

  @Post('2fa/email/verify-setup')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar codigo y activar 2FA por correo' })
  verifyTwoFactorEmailSetup(
    @Request() req,
    @Body() dto: VerifyTwoFactorEmailSetupDto,
  ) {
    return this.authService.verifyTwoFactorEmailSetup(req.user.id, dto.code);
  }

  @Post('2fa/email/disable')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desactivar 2FA por correo del usuario actual' })
  disableTwoFactorEmail(@Request() req, @Body() dto: DisableTwoFactorEmailDto) {
    return this.authService.disableTwoFactorEmail(req.user.id, dto.code);
  }

  @Post('2fa/email/request')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Solicitar codigo 2FA por correo durante el login' })
  requestTwoFactorEmailCode(@Body() dto: RequestTwoFactorEmailDto) {
    return this.authService.requestTwoFactorEmailCode(dto.temporary_token);
  }

  @Post('2fa/email/login')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Completar login con codigo 2FA por correo' })
  loginWithEmailCode(@Body() dto: LoginTwoFactorEmailDto, @Request() req) {
    return this.authService.loginWithEmailCode(
      dto.temporary_token,
      dto.code,
      this.getRequestContext(req),
    );
  }

  @Get('me')
  @SkipThrottle()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario actual' })
  @ApiResponse({
    status: 200,
    description: 'Retorna los datos del usuario autenticado',
  })
  getMe(@Request() req) {
    return this.authService.getMe(req.user.id);
  }
}
