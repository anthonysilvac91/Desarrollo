import { BadRequestException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { StoredFilesService } from '../storage/stored-files.service';
import { EmailService } from '../email/email.service';
import { toApiRole } from '../common/compat/owner-role-compat';
import {
  buildOtpAuthUrl,
  generateBackupCode,
  generateTotpSecret,
  normalizeCode,
  verifyTotpCode,
} from './totp.util';

export interface AuthRequestContext {
  userAgent?: string;
  ipAddress?: string;
  country?: string;
  region?: string;
  city?: string;
}

interface ResolvedIpLocation {
  ipAddress: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTokenTtlMs = 12 * 60 * 60 * 1000;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private storedFilesService: StoredFilesService,
    private emailService: EmailService,
  ) {}

  private buildAccessPayload(user: {
    id: string;
    role: string;
    organization_id: string | null;
    owner_id: string | null;
  }, session?: { id: string; token_jti: string }) {
    const sessionPayload = session ? { sid: session.id, jti: session.token_jti } : {};

    if (user.role === 'SUPER_ADMIN') {
      return { sub: user.id, orgId: null, role: 'SUPER_ADMIN', owner_id: null, ...sessionPayload };
    }

    return {
      sub: user.id,
      orgId: user.organization_id,
      role: toApiRole(user.role as any),
      owner_id: user.owner_id ?? null,
      ...sessionPayload,
    };
  }

  private signAccessToken(user: {
    id: string;
    role: string;
    organization_id: string | null;
    owner_id: string | null;
  }, session?: { id: string; token_jti: string }) {
    return this.jwtService.sign(this.buildAccessPayload(user, session));
  }

  private parseDevice(userAgent?: string) {
    const ua = userAgent || '';
    const isMobile = /Mobile|Android|iPhone|iPod/i.test(ua);
    const isTablet = /iPad|Tablet/i.test(ua);
    const device_type = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

    const browser =
      /Edg\/([\d.]+)/.exec(ua)?.[1] ? `Microsoft Edge ${/Edg\/([\d.]+)/.exec(ua)?.[1]}` :
      /Chrome\/([\d.]+)/.exec(ua)?.[1] ? `Chrome ${/Chrome\/([\d.]+)/.exec(ua)?.[1]}` :
      /Firefox\/([\d.]+)/.exec(ua)?.[1] ? `Firefox ${/Firefox\/([\d.]+)/.exec(ua)?.[1]}` :
      /Version\/([\d.]+).*Safari/.exec(ua)?.[1] ? `Safari ${/Version\/([\d.]+).*Safari/.exec(ua)?.[1]}` :
      /Safari\/([\d.]+)/.exec(ua)?.[1] ? 'Safari' :
      'Unknown browser';

    const os =
      /Windows NT 10/.test(ua) ? 'Windows 10/11' :
      /Windows NT 6\.3/.test(ua) ? 'Windows 8.1' :
      /Windows NT 6\.1/.test(ua) ? 'Windows 7' :
      /Mac OS X ([\d_]+)/.exec(ua)?.[1] ? `macOS ${/Mac OS X ([\d_]+)/.exec(ua)?.[1].replace(/_/g, '.')}` :
      /Android ([\d.]+)/.exec(ua)?.[1] ? `Android ${/Android ([\d.]+)/.exec(ua)?.[1]}` :
      /iPhone OS ([\d_]+)/.exec(ua)?.[1] ? `iOS ${/iPhone OS ([\d_]+)/.exec(ua)?.[1].replace(/_/g, '.')}` :
      /CPU OS ([\d_]+)/.exec(ua)?.[1] ? `iPadOS ${/CPU OS ([\d_]+)/.exec(ua)?.[1].replace(/_/g, '.')}` :
      /Linux/.test(ua) ? 'Linux' :
      'Unknown OS';

    const device_name =
      /iPhone/.test(ua) ? 'iPhone' :
      /iPad/.test(ua) ? 'iPad' :
      /Android/.test(ua) ? 'Android Device' :
      /Macintosh/.test(ua) ? 'Mac' :
      /Windows/.test(ua) ? 'Windows PC' :
      /Linux/.test(ua) ? 'Linux Device' :
      'Unknown Device';

    return { device_name, device_type, browser, os };
  }

  private normalizeIp(ip?: string) {
    if (!ip) return null;
    const first = ip.split(',')[0]?.trim();
    if (!first) return null;
    if (first === '::1') return '127.0.0.1';
    if (first.startsWith('::ffff:')) return first.replace('::ffff:', '');
    if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(first)) {
      return first.split(':')[0];
    }
    if (first.startsWith('[') && first.includes(']')) {
      return first.slice(1, first.indexOf(']'));
    }
    return first;
  }

  private isPrivateIp(ip: string) {
    return (
      ip === '127.0.0.1' ||
      ip === 'localhost' ||
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
      ip.startsWith('169.254.') ||
      ip === '::1' ||
      ip.startsWith('fc') ||
      ip.startsWith('fd')
    );
  }

  private parseGeoIpResponse(data: any): Omit<ResolvedIpLocation, 'ipAddress'> {
    return {
      country: data.country_name || data.countryName || data.country || data.countryCode || null,
      region: data.region || data.regionName || data.region_name || null,
      city: data.city || data.cityName || null,
    };
  }

  private async fetchGeoIpLocation(ip: string): Promise<Omit<ResolvedIpLocation, 'ipAddress'> | null> {
    const customTemplate = this.config.get<string>('GEOIP_LOOKUP_URL_TEMPLATE');
    const templates = [
      customTemplate,
      'https://ipapi.co/{ip}/json/',
      'https://ipwho.is/{ip}',
      'https://ipinfo.io/{ip}/json',
      'https://freeipapi.com/api/json/{ip}',
      'http://ip-api.com/json/{ip}?fields=status,country,countryCode,regionName,city,message',
    ].filter(Boolean) as string[];

    for (const template of templates) {
      try {
        const response = await fetch(template.replace('{ip}', encodeURIComponent(ip)), {
          signal: AbortSignal.timeout(1800),
        });

        if (!response.ok) continue;

        const data: any = await response.json();
        if (data.success === false || data.status === 'fail') continue;

        const location = this.parseGeoIpResponse(data);
        if (location.country || location.region || location.city) return location;
      } catch {
        continue;
      }
    }

    return null;
  }

  private async resolveIpLocation(context?: AuthRequestContext): Promise<ResolvedIpLocation> {
    const ip = this.normalizeIp(context?.ipAddress);
    const headerLocation = {
      country: context?.country || null,
      region: context?.region || null,
      city: context?.city || null,
    };

    if (!ip) return { ipAddress: null, ...headerLocation };

    if (headerLocation.country || headerLocation.region || headerLocation.city) {
      return { ipAddress: ip, ...headerLocation };
    }

    if (this.isPrivateIp(ip)) {
      return { ipAddress: ip, country: null, region: null, city: 'Local network' };
    }

    const lookupLocation = await this.fetchGeoIpLocation(ip);
    return { ipAddress: ip, ...(lookupLocation || headerLocation) };
  }

  private async createSession(user: {
    id: string;
    role: string;
    organization_id: string | null;
  }, context?: AuthRequestContext) {
    const now = new Date();
    const tokenJti = randomBytes(24).toString('hex');
    const device = this.parseDevice(context?.userAgent);
    const location = await this.resolveIpLocation(context);
    const existingSession = await this.prisma.userSession.findFirst({
      where: {
        user_id: user.id,
        revoked_at: null,
        expires_at: { gt: now },
        user_agent: context?.userAgent || null,
        ip_address: location.ipAddress,
      },
      orderBy: { last_seen_at: 'desc' },
    });

    if (existingSession) {
      return this.prisma.userSession.update({
        where: { id: existingSession.id },
        data: {
          token_jti: tokenJti,
          organization_id: user.organization_id,
          ...device,
          country: location.country ?? existingSession.country,
          region: location.region ?? existingSession.region,
          city: location.city ?? existingSession.city,
          last_seen_at: now,
          revoked_at: null,
          expires_at: new Date(now.getTime() + this.accessTokenTtlMs),
        },
      });
    }

    return this.prisma.userSession.create({
      data: {
        user_id: user.id,
        organization_id: user.organization_id,
        token_jti: tokenJti,
        ...device,
        user_agent: context?.userAgent || null,
        ip_address: location.ipAddress,
        country: location.country,
        region: location.region,
        city: location.city,
        first_seen_at: now,
        last_seen_at: now,
        expires_at: new Date(now.getTime() + this.accessTokenTtlMs),
      },
    });
  }

  private signTwoFactorLoginToken(userId: string) {
    return this.jwtService.sign(
      { sub: userId, purpose: '2fa_login' },
      { expiresIn: '5m' },
    );
  }

  private signTwoFactorSetupToken(userId: string, secret: string) {
    return this.jwtService.sign(
      { sub: userId, purpose: '2fa_setup', secret },
      { expiresIn: '10m' },
    );
  }

  async login(loginDto: LoginDto, context?: AuthRequestContext) {
    const user = await this.prisma.user.findFirst({
      where: { email: loginDto.email },
      include: { organization: { select: { id: true, is_active: true } } },
    });

    if (!user || !user.is_active) {
      this.logger.warn(`Failed login: ${loginDto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.password_hash);
    if (!isMatch) {
      this.logger.warn(`Failed login (wrong password): ${loginDto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.role === 'SUPER_ADMIN') {
      if (user.organization_id !== null) {
        this.logger.warn(`SUPER_ADMIN ${user.id} has organization_id, rejecting`);
        throw new UnauthorizedException('Invalid credentials');
      }
      if (user.two_factor_enabled) {
        return { requires_2fa: true, temporary_token: this.signTwoFactorLoginToken(user.id) };
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: { last_login_at: new Date() },
      });
      const session = await this.createSession(user, context);
      this.logger.log(`User ${user.id} logged in successfully`);
      return { access_token: this.signAccessToken(user, session) };
    }

    if (!user.organization_id || !user.organization || !user.organization.is_active) {
      this.logger.warn(`User ${user.id} missing or inactive organization`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.role === 'EXTERNAL' && !user.owner_id) {
      this.logger.warn(`EXTERNAL user ${user.id} missing owner_id`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.two_factor_enabled) {
      return { requires_2fa: true, temporary_token: this.signTwoFactorLoginToken(user.id) };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    const session = await this.createSession(user, context);
    this.logger.log(`User ${user.id} logged in successfully`);
    return { access_token: this.signAccessToken(user, session) };
  }

  async loginWithTwoFactor(temporaryToken: string, code: string, context?: AuthRequestContext) {
    let payload: any;
    try {
      payload = this.jwtService.verify(temporaryToken);
    } catch {
      throw new UnauthorizedException('Token 2FA invalido o expirado');
    }

    if (payload?.purpose !== '2fa_login' || !payload.sub) {
      throw new UnauthorizedException('Token 2FA invalido');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { organization: { select: { id: true, is_active: true } } },
    });

    if (!user || !user.is_active || !user.two_factor_enabled || !user.two_factor_secret) {
      throw new UnauthorizedException('2FA no disponible');
    }

    if (user.role !== 'SUPER_ADMIN') {
      if (!user.organization_id || !user.organization?.is_active) {
        throw new UnauthorizedException('Invalid credentials');
      }
      if (user.role === 'EXTERNAL' && !user.owner_id) {
        throw new UnauthorizedException('Invalid credentials');
      }
    }

    const backupCodes = Array.isArray(user.two_factor_backup_codes)
      ? user.two_factor_backup_codes as string[]
      : [];
    const backupResult = await this.verifyBackupCode(code, backupCodes);
    const validTotp = verifyTotpCode(user.two_factor_secret, code);

    if (!validTotp && !backupResult.valid) {
      throw new UnauthorizedException('Codigo 2FA invalido');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        last_login_at: new Date(),
        ...(backupResult.valid ? { two_factor_backup_codes: backupResult.remainingHashes } : {}),
      },
    });

    const session = await this.createSession(user, context);
    return { access_token: this.signAccessToken(user, session) };
  }

  async register(registerDto: RegisterDto, context?: AuthRequestContext) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token: registerDto.token },
      include: { organization: { select: { id: true, name: true, is_active: true } } },
    });

    if (!invitation || invitation.is_used || invitation.expires_at < new Date()) {
      throw new BadRequestException('Token de invitación inválido o expirado');
    }

    if (!invitation.organization.is_active) {
      throw new ForbiddenException('La organización no está activa');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email: invitation.email } });
    if (existingUser) {
      throw new BadRequestException('Ya existe una cuenta con este correo');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    const [user] = await this.prisma.$transaction([
      this.prisma.user.create({
        data: {
          email: invitation.email,
          name: registerDto.name,
          password_hash: passwordHash,
          role: invitation.role,
          organization_id: invitation.organization_id,
          owner_id: invitation.owner_id ?? registerDto.owner_id ?? null,
          email_verified_at: new Date(),
        },
      }),
      this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { is_used: true },
      }),
    ]);

    const session = await this.createSession(user, context);

    this.logger.log(`User ${user.id} registered via invitation`);
    return { access_token: this.signAccessToken(user, session) };
  }

  async getSessions(userId: string, currentSessionId?: string) {
    let sessions = await this.prisma.userSession.findMany({
      where: {
        user_id: userId,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
      orderBy: { last_seen_at: 'desc' },
    });

    const seenFingerprints = new Set<string>();
    const duplicateSessionIds: string[] = [];
    const dedupedSessions: typeof sessions = [];

    for (const session of sessions) {
      const fingerprint = `${session.user_agent || 'unknown'}|${session.ip_address || 'unknown'}`;
      if (session.id === currentSessionId) {
        const existingIndex = dedupedSessions.findIndex(
          (dedupedSession) => `${dedupedSession.user_agent || 'unknown'}|${dedupedSession.ip_address || 'unknown'}` === fingerprint,
        );
        if (existingIndex >= 0) {
          duplicateSessionIds.push(dedupedSessions[existingIndex].id);
          dedupedSessions.splice(existingIndex, 1);
        }
        seenFingerprints.add(fingerprint);
        dedupedSessions.push(session);
        continue;
      }

      if (!seenFingerprints.has(fingerprint) || session.id === currentSessionId) {
        seenFingerprints.add(fingerprint);
        dedupedSessions.push(session);
        continue;
      }

      duplicateSessionIds.push(session.id);
    }

    if (duplicateSessionIds.length > 0) {
      await this.prisma.userSession.updateMany({
        where: { id: { in: duplicateSessionIds }, user_id: userId },
        data: { revoked_at: new Date() },
      });
      sessions = dedupedSessions;
    }

    const sessionsToBackfill = sessions.filter((session) =>
      session.ip_address &&
      !this.isPrivateIp(session.ip_address) &&
      !session.country &&
      !session.region &&
      !session.city
    );

    if (sessionsToBackfill.length > 0) {
      const updates = await Promise.all(
        sessionsToBackfill.map(async (session) => {
          const location = await this.resolveIpLocation({ ipAddress: session.ip_address ?? undefined });
          if (!location.country && !location.region && !location.city) return null;

          await this.prisma.userSession.updateMany({
            where: { id: session.id, user_id: userId, revoked_at: null },
            data: {
              country: location.country,
              region: location.region,
              city: location.city,
            },
          });

          return { id: session.id, ...location };
        }),
      );

      sessions = sessions.map((session) => {
        const update = updates.find((item) => item?.id === session.id);
        return update
          ? { ...session, country: update.country, region: update.region, city: update.city }
          : session;
      });
    }

    return sessions.map((session) => ({
      id: session.id,
      device_name: session.device_name,
      device_type: session.device_type,
      browser: session.browser,
      os: session.os,
      ip_address: session.ip_address,
      location: [session.city, session.region, session.country].filter(Boolean).join(', ') || null,
      first_seen_at: session.first_seen_at,
      last_seen_at: session.last_seen_at,
      is_current: session.id === currentSessionId,
      user_agent: session.user_agent,
    }));
  }

  async revokeSession(userId: string, sessionId: string, currentSessionId?: string) {
    if (sessionId === currentSessionId) {
      throw new BadRequestException('No puedes cerrar la sesion actual desde esta accion');
    }

    await this.prisma.userSession.updateMany({
      where: { id: sessionId, user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });

    return { revoked: true };
  }

  async revokeOtherSessions(userId: string, currentSessionId?: string) {
    await this.prisma.userSession.updateMany({
      where: {
        user_id: userId,
        revoked_at: null,
        ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
      },
      data: { revoked_at: new Date() },
    });

    return { revoked: true };
  }

  async logout(userId: string, currentSessionId?: string) {
    if (!currentSessionId) return { revoked: false };

    await this.prisma.userSession.updateMany({
      where: { id: currentSessionId, user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });

    return { revoked: true };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({ where: { email, is_active: true } });

    // Respuesta genérica para no exponer si el email existe
    if (!user) {
      return { message: 'Si el correo existe recibirás un enlace de recuperación.' };
    }

    await this.prisma.emailToken.updateMany({
      where: { user_id: user.id, type: 'PASSWORD_RESET', used_at: null },
      data: { used_at: new Date() },
    });

    const token = randomBytes(32).toString('hex');
    await this.prisma.emailToken.create({
      data: {
        user_id: user.id,
        type: 'PASSWORD_RESET',
        token,
        expires_at: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await this.emailService.sendPasswordReset(user.email, user.name, resetUrl);
    this.logger.log(`Password reset email sent to ${user.email}`);

    return { message: 'Si el correo existe recibirás un enlace de recuperación.' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const emailToken = await this.prisma.emailToken.findUnique({
      where: { token },
    });

    if (
      !emailToken ||
      emailToken.type !== 'PASSWORD_RESET' ||
      emailToken.used_at !== null ||
      emailToken.expires_at < new Date()
    ) {
      throw new BadRequestException('Token inválido o expirado');
    }

    const hash = await bcrypt.hash(newPassword, 10);

    await Promise.all([
      this.prisma.user.update({
        where: { id: emailToken.user_id },
        data: { password_hash: hash },
      }),
      this.prisma.emailToken.update({
        where: { id: emailToken.id },
        data: { used_at: new Date() },
      }),
      this.prisma.userSession.updateMany({
        where: { user_id: emailToken.user_id, revoked_at: null },
        data: { revoked_at: new Date() },
      }),
    ]);

    this.logger.log(`Password reset completed for user ${emailToken.user_id}`);
    return { message: 'Contraseña actualizada correctamente' };
  }

  async getTwoFactorStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { two_factor_enabled: true, two_factor_backup_codes: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return {
      enabled: user.two_factor_enabled,
      backup_codes_remaining: Array.isArray(user.two_factor_backup_codes)
        ? user.two_factor_backup_codes.length
        : 0,
    };
  }

  async setupTwoFactor(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, two_factor_enabled: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (user.two_factor_enabled) {
      throw new BadRequestException('2FA ya esta activo');
    }

    const secret = generateTotpSecret();
    return {
      secret,
      otpauth_url: buildOtpAuthUrl({ issuer: 'Recall', accountName: user.email, secret }),
      setup_token: this.signTwoFactorSetupToken(user.id, secret),
    };
  }

  async verifyTwoFactorSetup(userId: string, setupToken: string, code: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(setupToken);
    } catch {
      throw new BadRequestException('Setup 2FA invalido o expirado');
    }

    if (payload?.purpose !== '2fa_setup' || payload.sub !== userId || !payload.secret) {
      throw new BadRequestException('Setup 2FA invalido');
    }

    if (!verifyTotpCode(payload.secret, code)) {
      throw new BadRequestException('Codigo 2FA invalido');
    }

    const backupCodes = Array.from({ length: 8 }, () => generateBackupCode());
    const backupHashes = await Promise.all(backupCodes.map((backupCode) => bcrypt.hash(backupCode, 10)));

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        two_factor_enabled: true,
        two_factor_secret: payload.secret,
        two_factor_backup_codes: backupHashes,
      },
    });

    return {
      enabled: true,
      backup_codes: backupCodes,
    };
  }

  async disableTwoFactor(userId: string, code?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        two_factor_enabled: true,
        two_factor_secret: true,
        two_factor_backup_codes: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (user.two_factor_enabled) {
      if (!code) {
        throw new BadRequestException('Debes ingresar un codigo 2FA');
      }

      const backupCodes = Array.isArray(user.two_factor_backup_codes)
        ? user.two_factor_backup_codes as string[]
        : [];
      const backupResult = await this.verifyBackupCode(code, backupCodes);
      const validTotp = !!user.two_factor_secret && verifyTotpCode(user.two_factor_secret, code);

      if (!validTotp && !backupResult.valid) {
        throw new BadRequestException('Codigo 2FA invalido');
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        two_factor_enabled: false,
        two_factor_secret: null,
        two_factor_backup_codes: Prisma.JsonNull,
      },
    });

    return { enabled: false };
  }

  private async verifyBackupCode(code: string, hashes: string[]) {
    const normalized = normalizeCode(code);
    for (let i = 0; i < hashes.length; i += 1) {
      if (await bcrypt.compare(normalized, hashes[i])) {
        return {
          valid: true,
          remainingHashes: hashes.filter((_, index) => index !== i),
        };
      }
    }

    return { valid: false, remainingHashes: hashes };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, is_active: true },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            brand_color: true,
            logo_file_id: true,
            default_asset_icon: true,
            show_org_name: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    (user as any).avatar_url = await this.storedFilesService.resolveFileUrl(user.avatar_file_id);

    if (user.organization) {
      (user.organization as any).logo_url = await this.storedFilesService.resolveFileUrl(
        user.organization.logo_file_id,
      );
    }

    const { password_hash, two_factor_secret, two_factor_backup_codes, ...result } = user;
    return {
      ...result,
      role: toApiRole(result.role),
      owner_id: result.owner_id,
    };
  }
}
