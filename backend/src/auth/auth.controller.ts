import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Delete,
  Param,
  Res,
} from '@nestjs/common';
import type {
  CookieOptions,
  Request as ExpressRequest,
  Response,
} from 'express';
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

type AuthenticatedRequest = ExpressRequest & {
  user: {
    id: string;
    session_id?: string;
  };
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private static readonly authCookieName = 'access_token';
  private static readonly accessTokenTtlMs = 12 * 60 * 60 * 1000;

  constructor(private authService: AuthService) {}

  private getCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: AuthController.accessTokenTtlMs,
    };
  }

  private setSessionCookie(
    res: Response,
    result: Record<string, unknown>,
  ): Record<string, unknown> {
    const token = result.access_token;
    if (typeof token === 'string' && token.length > 0) {
      res.cookie(AuthController.authCookieName, token, this.getCookieOptions());
    }

    const safeResult = { ...result };
    delete safeResult.access_token;
    return safeResult;
  }

  private clearSessionCookie(res: Response) {
    res.clearCookie(AuthController.authCookieName, {
      ...this.getCookieOptions(),
      maxAge: undefined,
    });
  }

  private firstHeader(value: unknown): string | undefined {
    if (Array.isArray(value)) {
      const [first] = value as unknown[];
      return typeof first === 'string' && first.trim()
        ? first.trim()
        : undefined;
    }
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private getRequestContext(req: ExpressRequest): AuthRequestContext {
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
  @ApiOperation({ summary: 'Iniciar sesion por Tenant' })
  @ApiResponse({ status: 201, description: 'Establece cookie de sesion' })
  async login(
    @Body() loginDto: LoginDto,
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      loginDto,
      this.getRequestContext(req),
    );
    return this.setSessionCookie(res, result);
  }

  @Post('register')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Registro mediante token de invitación' })
  async register(
    @Body() registerDto: RegisterDto,
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(
      registerDto,
      this.getRequestContext(req),
    );
    return this.setSessionCookie(res, result);
  }

  @Post('register-organization')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({
    summary: 'Crear una organizacion nueva y su administrador inicial',
  })
  async registerOrganization(
    @Body() dto: RegisterOrganizationDto,
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.registerOrganization(
      dto,
      this.getRequestContext(req),
    );
    return this.setSessionCookie(res, result);
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
  async loginWithTwoFactor(
    @Body() dto: LoginTwoFactorDto,
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginWithTwoFactor(
      dto.temporary_token,
      dto.code,
      this.getRequestContext(req),
    );
    return this.setSessionCookie(res, result);
  }

  @Get('sessions')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar sesiones activas del usuario actual' })
  getSessions(@Request() req: AuthenticatedRequest) {
    return this.authService.getSessions(req.user.id, req.user.session_id);
  }

  @Delete('sessions/:id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar una sesion activa del usuario actual' })
  revokeSession(
    @Request() req: AuthenticatedRequest,
    @Param('id') sessionId: string,
  ) {
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
  revokeOtherSessions(@Request() req: AuthenticatedRequest) {
    return this.authService.revokeOtherSessions(
      req.user.id,
      req.user.session_id,
    );
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar la sesion actual' })
  async logout(
    @Request() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.logout(
      req.user.id,
      req.user.session_id,
    );
    this.clearSessionCookie(res);
    return result;
  }

  @Get('2fa/status')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener estado 2FA del usuario actual' })
  getTwoFactorStatus(@Request() req: AuthenticatedRequest) {
    return this.authService.getTwoFactorStatus(req.user.id);
  }

  @Post('2fa/setup')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Iniciar configuracion TOTP para app autenticadora',
  })
  setupTwoFactor(@Request() req: AuthenticatedRequest) {
    return this.authService.setupTwoFactor(req.user.id);
  }

  @Post('2fa/verify-setup')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirmar configuracion TOTP y activar 2FA' })
  verifyTwoFactorSetup(
    @Request() req: AuthenticatedRequest,
    @Body() dto: VerifyTwoFactorSetupDto,
  ) {
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
  disableTwoFactor(
    @Request() req: AuthenticatedRequest,
    @Body() dto: DisableTwoFactorDto,
  ) {
    return this.authService.disableTwoFactor(req.user.id, dto.code);
  }

  @Post('2fa/email/send-code')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Enviar codigo 2FA al correo del usuario autenticado',
  })
  sendTwoFactorEmailCode(@Request() req: AuthenticatedRequest) {
    return this.authService.sendTwoFactorEmailCode(req.user.id);
  }

  @Post('2fa/email/verify-setup')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar codigo y activar 2FA por correo' })
  verifyTwoFactorEmailSetup(
    @Request() req: AuthenticatedRequest,
    @Body() dto: VerifyTwoFactorEmailSetupDto,
  ) {
    return this.authService.verifyTwoFactorEmailSetup(req.user.id, dto.code);
  }

  @Post('2fa/email/disable')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desactivar 2FA por correo del usuario actual' })
  disableTwoFactorEmail(
    @Request() req: AuthenticatedRequest,
    @Body() dto: DisableTwoFactorEmailDto,
  ) {
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
  async loginWithEmailCode(
    @Body() dto: LoginTwoFactorEmailDto,
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginWithEmailCode(
      dto.temporary_token,
      dto.code,
      this.getRequestContext(req),
    );
    return this.setSessionCookie(res, result);
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
  getMe(@Request() req: AuthenticatedRequest) {
    return this.authService.getMe(req.user.id);
  }
}
