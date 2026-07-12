import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserSession } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { aesGcmDecrypt, aesGcmEncrypt, isAesGcmEncrypted, sha256hex } from '../common/crypto.util';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { StoredFilesService } from '../storage/stored-files.service';
import { EmailService } from '../email/email.service';
import { PLAN_LIMITS } from '../subscriptions/plan-limits';
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

  private buildAccessPayload(
    user: {
      id: string;
      role: string;
      organization_id: string | null;
      owner_id: string | null;
    },
    session?: { id: string; token_jti: string },
    impersonatorId?: string,
  ) {
    const sessionPayload = session
      ? { sid: session.id, jti: session.token_jti }
      : {};
    const impersonationPayload = impersonatorId ? { imp: impersonatorId } : {};

    if (user.role === 'SUPER_ADMIN') {
      return {
        sub: user.id,
        orgId: null,
        role: 'SUPER_ADMIN',
        owner_id: null,
        ...sessionPayload,
        ...impersonationPayload,
      };
    }

    return {
      sub: user.id,
      orgId: user.organization_id,
      role: toApiRole(user.role as any),
      owner_id: user.owner_id ?? null,
      ...sessionPayload,
      ...impersonationPayload,
    };
  }

  private signAccessToken(
    user: {
      id: string;
      role: string;
      organization_id: string | null;
      owner_id: string | null;
    },
    session?: { id: string; token_jti: string },
    impersonatorId?: string,
  ) {
    return this.jwtService.sign(
      this.buildAccessPayload(user, session, impersonatorId),
    );
  }

  private parseDevice(userAgent?: string) {
    const ua = userAgent || '';
    const isMobile = /Mobile|Android|iPhone|iPod/i.test(ua);
    const isTablet = /iPad|Tablet/i.test(ua);
    const device_type = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

    const browser = /Edg\/([\d.]+)/.exec(ua)?.[1]
      ? `Microsoft Edge ${/Edg\/([\d.]+)/.exec(ua)?.[1]}`
      : /Chrome\/([\d.]+)/.exec(ua)?.[1]
        ? `Chrome ${/Chrome\/([\d.]+)/.exec(ua)?.[1]}`
        : /Firefox\/([\d.]+)/.exec(ua)?.[1]
          ? `Firefox ${/Firefox\/([\d.]+)/.exec(ua)?.[1]}`
          : /Version\/([\d.]+).*Safari/.exec(ua)?.[1]
            ? `Safari ${/Version\/([\d.]+).*Safari/.exec(ua)?.[1]}`
            : /Safari\/([\d.]+)/.exec(ua)?.[1]
              ? 'Safari'
              : 'Unknown browser';

    const os = /Windows NT 10/.test(ua)
      ? 'Windows 10/11'
      : /Windows NT 6\.3/.test(ua)
        ? 'Windows 8.1'
        : /Windows NT 6\.1/.test(ua)
          ? 'Windows 7'
          : /Mac OS X ([\d_]+)/.exec(ua)?.[1]
            ? `macOS ${/Mac OS X ([\d_]+)/.exec(ua)?.[1].replace(/_/g, '.')}`
            : /Android ([\d.]+)/.exec(ua)?.[1]
              ? `Android ${/Android ([\d.]+)/.exec(ua)?.[1]}`
              : /iPhone OS ([\d_]+)/.exec(ua)?.[1]
                ? `iOS ${/iPhone OS ([\d_]+)/.exec(ua)?.[1].replace(/_/g, '.')}`
                : /CPU OS ([\d_]+)/.exec(ua)?.[1]
                  ? `iPadOS ${/CPU OS ([\d_]+)/.exec(ua)?.[1].replace(/_/g, '.')}`
                  : /Linux/.test(ua)
                    ? 'Linux'
                    : 'Unknown OS';

    const device_name = /iPhone/.test(ua)
      ? 'iPhone'
      : /iPad/.test(ua)
        ? 'iPad'
        : /Android/.test(ua)
          ? 'Android Device'
          : /Macintosh/.test(ua)
            ? 'Mac'
            : /Windows/.test(ua)
              ? 'Windows PC'
              : /Linux/.test(ua)
                ? 'Linux Device'
                : 'Unknown Device';

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
      country:
        data.country_name ||
        data.countryName ||
        data.country ||
        data.countryCode ||
        null,
      region: data.region || data.regionName || data.region_name || null,
      city: data.city || data.cityName || null,
    };
  }

  private async fetchGeoIpLocation(
    ip: string,
  ): Promise<Omit<ResolvedIpLocation, 'ipAddress'> | null> {
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
        const response = await fetch(
          template.replace('{ip}', encodeURIComponent(ip)),
          {
            signal: AbortSignal.timeout(1800),
          },
        );

        if (!response.ok) continue;

        const data: any = await response.json();
        if (data.success === false || data.status === 'fail') continue;

        const location = this.parseGeoIpResponse(data);
        if (location.country || location.region || location.city)
          return location;
      } catch {
        continue;
      }
    }

    return null;
  }

  private async resolveIpLocation(
    context?: AuthRequestContext,
  ): Promise<ResolvedIpLocation> {
    const ip = this.normalizeIp(context?.ipAddress);
    const headerLocation = {
      country: context?.country || null,
      region: context?.region || null,
      city: context?.city || null,
    };

    if (!ip) return { ipAddress: null, ...headerLocation };

    if (
      headerLocation.country ||
      headerLocation.region ||
      headerLocation.city
    ) {
      return { ipAddress: ip, ...headerLocation };
    }

    if (this.isPrivateIp(ip)) {
      return {
        ipAddress: ip,
        country: null,
        region: null,
        city: 'Local network',
      };
    }

    const lookupLocation = await this.fetchGeoIpLocation(ip);
    return { ipAddress: ip, ...(lookupLocation || headerLocation) };
  }

  private async createSession(
    user: {
      id: string;
      role: string;
      organization_id: string | null;
    },
    context?: AuthRequestContext,
  ): Promise<{ session: UserSession; isNewDevice: boolean }> {
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
      const session = await this.prisma.userSession.update({
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
      return { session, isNewDevice: false };
    }

    const hadAnyPriorSession = await this.prisma.userSession.findFirst({
      where: { user_id: user.id },
      select: { id: true },
    });

    const session = await this.prisma.userSession.create({
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
    return { session, isNewDevice: !!hadAnyPriorSession };
  }

  private notifyNewDeviceLogin(
    user: { email: string; name: string; security_alerts_enabled?: boolean },
    session: UserSession,
    language: 'en' | 'es' = 'es',
  ): void {
    if (user.security_alerts_enabled === false) return;
    this.emailService
      .sendNewDeviceLogin(
        user.email,
        user.name,
        {
          browser: session.browser,
          os: session.os,
          deviceType: session.device_type,
          city: session.city,
          country: session.country,
          ipAddress: session.ip_address,
        },
        language,
      )
      .catch((err) =>
        this.logger.error(
          `Failed to send new-device login notice to ${user.email}`,
          err,
        ),
      );
  }

  private notifyTwoFactorStatusChanged(
    userId: string,
    enabled: boolean,
    language: 'en' | 'es' = 'es',
  ): void {
    this.prisma.user
      .findUnique({
        where: { id: userId },
        select: { email: true, name: true, security_alerts_enabled: true },
      })
      .then((user) => {
        if (!user || !user.security_alerts_enabled) return;
        return this.emailService.sendTwoFactorStatusChanged(
          user.email,
          user.name,
          enabled,
          language,
        );
      })
      .catch((err) =>
        this.logger.error(
          `Failed to send 2FA-status notice for user ${userId}`,
          err,
        ),
      );
  }

  private signTwoFactorLoginToken(userId: string) {
    return this.jwtService.sign(
      { sub: userId, purpose: '2fa_login' },
      { expiresIn: '5m' },
    );
  }

  private signTwoFactorSetupToken(userId: string) {
    return this.jwtService.sign(
      { sub: userId, purpose: '2fa_setup' },
      { expiresIn: '10m' },
    );
  }

  private getTotpEncryptionKey(): string {
    const key =
      this.config.get<string>('INTEGRATION_SECRET_KEY') ||
      this.config.get<string>('JWT_SECRET');
    if (!key) {
      throw new Error('INTEGRATION_SECRET_KEY or JWT_SECRET required for TOTP encryption');
    }
    return key;
  }

  private encryptTotpSecret(secret: string): string {
    return aesGcmEncrypt(secret, this.getTotpEncryptionKey());
  }

  private decryptTotpSecret(encrypted: string): string {
    return aesGcmDecrypt(encrypted, this.getTotpEncryptionKey());
  }

  private normalizeSlugBase(name: string): string {
    return (
      name
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 36) || 'organization'
    );
  }

  private async buildUniqueOrganizationSlug(name: string) {
    const base = this.normalizeSlugBase(name);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const suffix = randomBytes(3).toString('hex');
      const slug = `${base}-${suffix}`;
      const existing = await this.prisma.organization.findUnique({
        where: { slug },
      });
      if (!existing) return slug;
    }

    return `${base}-${randomBytes(8).toString('hex')}`;
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
        this.logger.warn(
          `SUPER_ADMIN ${user.id} has organization_id, rejecting`,
        );
        throw new UnauthorizedException('Invalid credentials');
      }
      if (user.two_factor_enabled) {
        return {
          requires_2fa: true,
          temporary_token: this.signTwoFactorLoginToken(user.id),
          method: (user.two_factor_method ?? 'APP').toLowerCase(),
        };
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          last_login_at: new Date(),
          ...(loginDto.language ? { language: loginDto.language } : {}),
        },
      });
      const { session, isNewDevice } = await this.createSession(
        user,
        context,
      );
      if (isNewDevice) {
        this.notifyNewDeviceLogin(user, session, loginDto.language);
      }
      this.logger.log(`User ${user.id} logged in successfully`);
      return { access_token: this.signAccessToken(user, session) };
    }

    if (
      !user.organization_id ||
      !user.organization ||
      !user.organization.is_active
    ) {
      this.logger.warn(`User ${user.id} missing or inactive organization`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.role === 'EXTERNAL' && !user.owner_id) {
      this.logger.warn(`EXTERNAL user ${user.id} missing owner_id`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.two_factor_enabled) {
      return {
        requires_2fa: true,
        temporary_token: this.signTwoFactorLoginToken(user.id),
        method: (user.two_factor_method ?? 'APP').toLowerCase(),
      };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        last_login_at: new Date(),
        ...(loginDto.language ? { language: loginDto.language } : {}),
      },
    });

    const { session, isNewDevice } = await this.createSession(user, context);
    if (isNewDevice) {
      this.notifyNewDeviceLogin(user, session, loginDto.language);
    }
    this.logger.log(`User ${user.id} logged in successfully`);
    return { access_token: this.signAccessToken(user, session) };
  }

  async loginWithTwoFactor(
    temporaryToken: string,
    code: string,
    context?: AuthRequestContext,
    language: 'en' | 'es' = 'es',
  ) {
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

    if (
      !user ||
      !user.is_active ||
      !user.two_factor_enabled ||
      !user.two_factor_secret ||
      user.two_factor_method !== 'APP'
    ) {
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
      ? (user.two_factor_backup_codes as string[])
      : [];
    const backupResult = await this.verifyBackupCode(code, backupCodes);

    let validTotp = false;
    if (user.two_factor_secret) {
      const totpSecret = isAesGcmEncrypted(user.two_factor_secret)
        ? this.decryptTotpSecret(user.two_factor_secret)
        : user.two_factor_secret;
      validTotp = verifyTotpCode(totpSecret, code);
    }

    if (!validTotp && !backupResult.valid) {
      throw new UnauthorizedException('Codigo 2FA invalido');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        last_login_at: new Date(),
        language,
        ...(backupResult.valid
          ? { two_factor_backup_codes: backupResult.remainingHashes }
          : {}),
      },
    });

    const { session, isNewDevice } = await this.createSession(user, context);
    if (isNewDevice) {
      this.notifyNewDeviceLogin(user, session, language);
    }
    return { access_token: this.signAccessToken(user, session) };
  }

  async register(registerDto: RegisterDto, context?: AuthRequestContext) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token: sha256hex(registerDto.token) },
      include: {
        organization: { select: { id: true, name: true, is_active: true } },
      },
    });

    if (
      !invitation ||
      invitation.is_used ||
      invitation.expires_at < new Date()
    ) {
      throw new BadRequestException('Token de invitación inválido o expirado');
    }

    if (!invitation.organization.is_active) {
      throw new ForbiddenException('La organización no está activa');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });
    if (existingUser) {
      throw new BadRequestException('Ya existe una cuenta con este correo');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: invitation.email,
          name: registerDto.name,
          password_hash: passwordHash,
          role: invitation.role,
          organization_id: invitation.organization_id,
          owner_id: invitation.owner_id ?? registerDto.owner_id ?? null,
          email_verified_at: new Date(),
          ...(registerDto.language ? { language: registerDto.language } : {}),
          ...(invitation.role === 'WORKER'
            ? { asset_access_mode: invitation.asset_access_mode }
            : {}),
        },
      });

      if (
        invitation.role === 'WORKER' &&
        invitation.asset_access_mode === 'RESTRICTED' &&
        invitation.pending_asset_ids.length > 0
      ) {
        await tx.workerAssetAccess.createMany({
          data: invitation.pending_asset_ids.map((assetId) => ({
            worker_id: createdUser.id,
            asset_id: assetId,
            organization_id: invitation.organization_id,
            granted_by_id: invitation.invited_by_id,
          })),
        });
      }

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { is_used: true },
      });

      return createdUser;
    });

    const { session } = await this.createSession(user, context);

    try {
      await this.emailService.sendWelcome(
        user.email,
        user.name,
        invitation.organization.name,
        registerDto.language,
      );
    } catch (err) {
      this.logger.error(
        'Failed to send welcome email after invitation registration',
        err,
      );
    }

    const inviter = await this.prisma.user.findUnique({
      where: { id: invitation.invited_by_id },
      select: {
        email: true,
        name: true,
        language: true,
        email_notifications_enabled: true,
      },
    });
    if (inviter && inviter.email_notifications_enabled) {
      this.emailService
        .sendInvitationAccepted(
          inviter.email,
          inviter.name,
          user.name,
          user.email,
          invitation.organization.name,
          inviter.language as 'en' | 'es',
        )
        .catch((err) =>
          this.logger.error('Failed to send invitation-accepted notice', err),
        );
    }

    this.logger.log(`User ${user.id} registered via invitation`);
    return { access_token: this.signAccessToken(user, session) };
  }

  async registerOrganization(
    dto: RegisterOrganizationDto,
    context?: AuthRequestContext,
  ) {
    const email = dto.email.trim().toLowerCase();
    const organizationName = dto.organization_name.trim();
    const adminName = dto.admin_name.trim();

    if (!organizationName) {
      throw new BadRequestException('Organization name is required');
    }

    if (!adminName) {
      throw new BadRequestException('Admin name is required');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new BadRequestException(
        'An account with this email already exists',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const slug = await this.buildUniqueOrganizationSlug(organizationName);

    const { organization, user } = await this.prisma.$transaction(
      async (tx) => {
        const organization = await tx.organization.create({
          data: {
            name: organizationName,
            slug,
            is_active: true,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            is_active: true,
          },
        });

        const user = await tx.user.create({
          data: {
            email,
            name: adminName,
            password_hash: passwordHash,
            role: 'ADMIN',
            organization_id: organization.id,
            owner_id: null,
            ...(dto.language ? { language: dto.language } : {}),
          },
        });

        const limits = PLAN_LIMITS.DEMO;
        await tx.subscription.create({
          data: {
            organization_id: organization.id,
            plan: 'DEMO',
            status: 'TRIALING',
            max_users: limits.max_users,
            max_assets: limits.max_assets,
            max_storage_gb: limits.max_storage_gb,
            max_video_hours: limits.max_video_hours,
            allow_external: limits.allow_external,
            allow_branding: limits.allow_branding,
            allow_ai_translation: limits.allow_ai_translation,
            demo_expires_at: new Date(
              Date.now() + limits.demo_duration_days! * 24 * 60 * 60 * 1000,
            ),
          },
        });

        await tx.organizationStorageUsage.create({
          data: {
            organization_id: organization.id,
            ready_bytes: 0,
            reserved_bytes: 0,
            ready_file_count: 0,
            pending_upload_count: 0,
          },
        });

        return { organization, user };
      },
    );

    const { session } = await this.createSession(user, context);

    try {
      await this.emailService.sendWelcome(
        user.email,
        user.name,
        organization.name,
        dto.language,
      );
    } catch (err) {
      this.logger.error(
        'Failed to send welcome email after organization registration',
        err,
      );
    }

    this.logger.log(
      `Organization ${organization.id} registered with admin ${user.id}`,
    );
    return {
      access_token: this.signAccessToken(user, session),
      organization,
    };
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
          (dedupedSession) =>
            `${dedupedSession.user_agent || 'unknown'}|${dedupedSession.ip_address || 'unknown'}` ===
            fingerprint,
        );
        if (existingIndex >= 0) {
          duplicateSessionIds.push(dedupedSessions[existingIndex].id);
          dedupedSessions.splice(existingIndex, 1);
        }
        seenFingerprints.add(fingerprint);
        dedupedSessions.push(session);
        continue;
      }

      if (
        !seenFingerprints.has(fingerprint) ||
        session.id === currentSessionId
      ) {
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

    const sessionsToBackfill = sessions.filter(
      (session) =>
        session.ip_address &&
        !this.isPrivateIp(session.ip_address) &&
        !session.country &&
        !session.region &&
        !session.city,
    );

    if (sessionsToBackfill.length > 0) {
      const updates = await Promise.all(
        sessionsToBackfill.map(async (session) => {
          const location = await this.resolveIpLocation({
            ipAddress: session.ip_address ?? undefined,
          });
          if (!location.country && !location.region && !location.city)
            return null;

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
          ? {
              ...session,
              country: update.country,
              region: update.region,
              city: update.city,
            }
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
      location:
        [session.city, session.region, session.country]
          .filter(Boolean)
          .join(', ') || null,
      first_seen_at: session.first_seen_at,
      last_seen_at: session.last_seen_at,
      is_current: session.id === currentSessionId,
      user_agent: session.user_agent,
    }));
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    currentSessionId?: string,
  ) {
    if (sessionId === currentSessionId) {
      throw new BadRequestException(
        'No puedes cerrar la sesion actual desde esta accion',
      );
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

  /**
   * Solo SUPER_ADMIN puede impersonar, y nunca a otro SUPER_ADMIN (evita
   * cadenas de escalado de privilegios). El token resultante lleva el claim
   * `imp` con el id del super admin original para poder volver via
   * stopImpersonation.
   */
  async impersonate(
    actingUser: { id: string; role: string },
    targetUserId: string,
    context?: AuthRequestContext,
  ) {
    if (actingUser.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Solo un Super Admin puede impersonar usuarios');
    }

    if (targetUserId === actingUser.id) {
      throw new BadRequestException('No puedes impersonarte a ti mismo');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { organization: { select: { id: true, is_active: true } } },
    });

    if (!targetUser || !targetUser.is_active) {
      throw new BadRequestException('Usuario no encontrado o inactivo');
    }

    if (targetUser.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('No puedes impersonar a otro Super Admin');
    }

    if (
      !targetUser.organization_id ||
      !targetUser.organization ||
      !targetUser.organization.is_active
    ) {
      throw new BadRequestException('El usuario no tiene una organizacion activa');
    }

    if (targetUser.role === 'EXTERNAL' && !targetUser.owner_id) {
      throw new BadRequestException('Usuario externo invalido');
    }

    const { session } = await this.createSession(targetUser, context);

    this.logger.warn(
      `IMPERSONATION START: super_admin=${actingUser.id} -> target_user=${targetUserId}`,
    );

    return {
      access_token: this.signAccessToken(targetUser, session, actingUser.id),
    };
  }

  async stopImpersonation(
    actingUser: { id: string; impersonator_id?: string | null },
    context?: AuthRequestContext,
  ) {
    if (!actingUser.impersonator_id) {
      throw new BadRequestException('No estas impersonando a ningun usuario');
    }

    const originalUser = await this.prisma.user.findUnique({
      where: { id: actingUser.impersonator_id },
    });

    if (
      !originalUser ||
      !originalUser.is_active ||
      originalUser.role !== 'SUPER_ADMIN' ||
      originalUser.organization_id !== null
    ) {
      throw new UnauthorizedException('La sesion original ya no es valida');
    }

    const { session } = await this.createSession(originalUser, context);

    this.logger.warn(
      `IMPERSONATION END: super_admin=${originalUser.id} restored from target_user=${actingUser.id}`,
    );

    return { access_token: this.signAccessToken(originalUser, session) };
  }

  async getImpersonatorSummary(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    return user ?? null;
  }

  async forgotPassword(
    email: string,
    language: 'en' | 'es' = 'es',
  ): Promise<{ message: string }> {
    const genericResponse = {
      message: 'Si el correo existe recibirás un enlace de recuperación.',
    };

    if (!this.emailService.isEnabled()) {
      this.logger.error(
        'forgotPassword called but EmailService is disabled (RESEND_API_KEY missing)',
      );
      return genericResponse;
    }

    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    if (!frontendUrl) {
      this.logger.error(
        'FRONTEND_URL is not set — cannot build password reset link',
      );
      return genericResponse;
    }

    const user = await this.prisma.user.findFirst({
      where: { email, is_active: true },
    });

    // Respuesta genérica para no exponer si el email existe
    if (!user) {
      return genericResponse;
    }

    await this.prisma.emailToken.updateMany({
      where: { user_id: user.id, type: 'PASSWORD_RESET', used_at: null },
      data: { used_at: new Date() },
    });

    const rawToken = randomBytes(32).toString('hex');
    await this.prisma.emailToken.create({
      data: {
        user_id: user.id,
        type: 'PASSWORD_RESET',
        token: sha256hex(rawToken),
        expires_at: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;
    await this.emailService.sendPasswordReset(
      user.email,
      user.name,
      resetUrl,
      language,
    );
    this.logger.log('Password reset email sent');

    return genericResponse;
  }

  async resetPassword(
    token: string,
    newPassword: string,
    language: 'en' | 'es' = 'es',
  ): Promise<{ message: string }> {
    const emailToken = await this.prisma.emailToken.findUnique({
      where: { token: sha256hex(token) },
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

    const [updatedUser] = await Promise.all([
      this.prisma.user.update({
        where: { id: emailToken.user_id },
        data: { password_hash: hash },
        select: { email: true, name: true, security_alerts_enabled: true },
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

    if (updatedUser.security_alerts_enabled) {
      this.emailService
        .sendPasswordChanged(updatedUser.email, updatedUser.name, language)
        .catch((err) =>
          this.logger.error('Failed to send password-changed notice', err),
        );
    }

    this.logger.log(`Password reset completed for user ${emailToken.user_id}`);
    return { message: 'Contraseña actualizada correctamente' };
  }

  async getTwoFactorStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        two_factor_enabled: true,
        two_factor_method: true,
        two_factor_backup_codes: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return {
      enabled: user.two_factor_enabled,
      method: (user.two_factor_method ?? 'APP').toLowerCase() as
        | 'app'
        | 'email',
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
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.pendingTotpSetup.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        encrypted_secret: this.encryptTotpSecret(secret),
        expires_at: expiresAt,
      },
      update: {
        encrypted_secret: this.encryptTotpSecret(secret),
        expires_at: expiresAt,
        consumed_at: null,
      },
    });

    return {
      secret,
      otpauth_url: buildOtpAuthUrl({
        issuer: 'Fentri',
        accountName: user.email,
        secret,
      }),
      setup_token: this.signTwoFactorSetupToken(user.id),
    };
  }

  async verifyTwoFactorSetup(
    userId: string,
    setupToken: string,
    code: string,
    language: 'en' | 'es' = 'es',
  ) {
    let payload: any;
    try {
      payload = this.jwtService.verify(setupToken);
    } catch {
      throw new BadRequestException('Setup 2FA invalido o expirado');
    }

    if (payload?.purpose !== '2fa_setup' || payload.sub !== userId) {
      throw new BadRequestException('Setup 2FA invalido');
    }

    const pending = await this.prisma.pendingTotpSetup.findUnique({
      where: { user_id: userId },
    });

    if (
      !pending ||
      pending.consumed_at !== null ||
      pending.expires_at < new Date()
    ) {
      throw new BadRequestException('Setup 2FA invalido o expirado');
    }

    const secret = this.decryptTotpSecret(pending.encrypted_secret);

    if (!verifyTotpCode(secret, code)) {
      throw new BadRequestException('Codigo 2FA invalido');
    }

    const backupCodes = Array.from({ length: 8 }, () => generateBackupCode());
    const backupHashes = await Promise.all(
      backupCodes.map((backupCode) => bcrypt.hash(backupCode, 10)),
    );

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          two_factor_enabled: true,
          two_factor_secret: this.encryptTotpSecret(secret),
          two_factor_backup_codes: backupHashes,
        },
      }),
      this.prisma.pendingTotpSetup.update({
        where: { user_id: userId },
        data: { consumed_at: new Date() },
      }),
    ]);

    this.notifyTwoFactorStatusChanged(userId, true, language);

    return {
      enabled: true,
      backup_codes: backupCodes,
    };
  }

  async disableTwoFactor(
    userId: string,
    code?: string,
    language: 'en' | 'es' = 'es',
  ) {
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
        ? (user.two_factor_backup_codes as string[])
        : [];
      const backupResult = await this.verifyBackupCode(code, backupCodes);

      let validTotp = false;
      if (user.two_factor_secret) {
        const totpSecret = isAesGcmEncrypted(user.two_factor_secret)
          ? this.decryptTotpSecret(user.two_factor_secret)
          : user.two_factor_secret;
        validTotp = verifyTotpCode(totpSecret, code);
      }

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

    this.notifyTwoFactorStatusChanged(userId, false, language);

    return { enabled: false };
  }

  async sendTwoFactorEmailCode(userId: string, language: 'en' | 'es' = 'es') {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const code = this.generateNumericCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.emailToken.deleteMany({
      where: { user_id: userId, type: 'TWO_FACTOR_CODE', used_at: null },
    });
    await this.prisma.emailToken.create({
      data: {
        id: randomBytes(16).toString('hex'),
        user_id: userId,
        type: 'TWO_FACTOR_CODE',
        token: sha256hex(code),
        expires_at: expiresAt,
      },
    });

    await this.emailService.sendTwoFactorCode(
      user.email,
      user.name,
      code,
      language,
    );
    return { sent: true };
  }

  async verifyTwoFactorEmailSetup(
    userId: string,
    code: string,
    language: 'en' | 'es' = 'es',
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, two_factor_enabled: true },
    });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    if (user.two_factor_enabled)
      throw new BadRequestException('2FA ya esta activo');

    const emailToken = await this.prisma.emailToken.findFirst({
      where: {
        user_id: userId,
        type: 'TWO_FACTOR_CODE',
        used_at: null,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!emailToken || emailToken.token !== sha256hex(code.trim())) {
      throw new BadRequestException('Codigo invalido o expirado');
    }

    await this.prisma.emailToken.update({
      where: { id: emailToken.id },
      data: { used_at: new Date() },
    });

    const backupCodes = Array.from({ length: 8 }, () => generateBackupCode());
    const backupHashes = await Promise.all(
      backupCodes.map((c) => bcrypt.hash(c, 10)),
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        two_factor_enabled: true,
        two_factor_method: 'EMAIL',
        two_factor_secret: null,
        two_factor_backup_codes: backupHashes,
      },
    });

    this.notifyTwoFactorStatusChanged(userId, true, language);

    return { enabled: true, backup_codes: backupCodes };
  }

  async disableTwoFactorEmail(
    userId: string,
    code: string,
    language: 'en' | 'es' = 'es',
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        two_factor_enabled: true,
        two_factor_method: true,
        two_factor_backup_codes: true,
      },
    });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    if (!user.two_factor_enabled || user.two_factor_method !== 'EMAIL') {
      throw new BadRequestException('2FA por correo no esta activo');
    }

    const normalizedCode = normalizeCode(code);
    const backupCodes = Array.isArray(user.two_factor_backup_codes)
      ? (user.two_factor_backup_codes as string[])
      : [];
    const backupResult = await this.verifyBackupCode(
      normalizedCode,
      backupCodes,
    );

    const emailToken = await this.prisma.emailToken.findFirst({
      where: {
        user_id: userId,
        type: 'TWO_FACTOR_CODE',
        used_at: null,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
    });
    const validEmailCode = emailToken && emailToken.token === sha256hex(normalizedCode);

    if (!backupResult.valid && !validEmailCode) {
      throw new BadRequestException('Codigo invalido o expirado');
    }

    if (validEmailCode && emailToken) {
      await this.prisma.emailToken.update({
        where: { id: emailToken.id },
        data: { used_at: new Date() },
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        two_factor_enabled: false,
        two_factor_method: 'APP',
        two_factor_secret: null,
        two_factor_backup_codes: Prisma.JsonNull,
      },
    });

    this.notifyTwoFactorStatusChanged(userId, false, language);

    return { enabled: false };
  }

  async requestTwoFactorEmailCode(
    temporaryToken: string,
    language: 'en' | 'es' = 'es',
  ) {
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
      select: {
        id: true,
        email: true,
        name: true,
        is_active: true,
        two_factor_enabled: true,
        two_factor_method: true,
      },
    });

    if (
      !user ||
      !user.is_active ||
      !user.two_factor_enabled ||
      user.two_factor_method !== 'EMAIL'
    ) {
      throw new UnauthorizedException('2FA por correo no disponible');
    }

    const code = this.generateNumericCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.emailToken.deleteMany({
      where: { user_id: user.id, type: 'TWO_FACTOR_CODE', used_at: null },
    });
    await this.prisma.emailToken.create({
      data: {
        id: randomBytes(16).toString('hex'),
        user_id: user.id,
        type: 'TWO_FACTOR_CODE',
        token: sha256hex(code),
        expires_at: expiresAt,
      },
    });

    await this.emailService.sendTwoFactorCode(
      user.email,
      user.name,
      code,
      language,
    );
    return { sent: true };
  }

  async loginWithEmailCode(
    temporaryToken: string,
    code: string,
    context?: AuthRequestContext,
    language: 'en' | 'es' = 'es',
  ) {
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

    if (
      !user ||
      !user.is_active ||
      !user.two_factor_enabled ||
      user.two_factor_method !== 'EMAIL'
    ) {
      throw new UnauthorizedException('2FA por correo no disponible');
    }

    if (user.role !== 'SUPER_ADMIN') {
      if (!user.organization_id || !user.organization?.is_active) {
        throw new UnauthorizedException('Invalid credentials');
      }
      if (user.role === 'EXTERNAL' && !user.owner_id) {
        throw new UnauthorizedException('Invalid credentials');
      }
    }

    const normalizedCode = normalizeCode(code);
    const backupCodes = Array.isArray(user.two_factor_backup_codes)
      ? (user.two_factor_backup_codes as string[])
      : [];
    const backupResult = await this.verifyBackupCode(
      normalizedCode,
      backupCodes,
    );

    if (backupResult.valid) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          last_login_at: new Date(),
          language,
          two_factor_backup_codes: backupResult.remainingHashes,
        },
      });
      const { session, isNewDevice } = await this.createSession(
        user,
        context,
      );
      if (isNewDevice) {
        this.notifyNewDeviceLogin(user, session, language);
      }
      return { access_token: this.signAccessToken(user, session) };
    }

    const emailToken = await this.prisma.emailToken.findFirst({
      where: {
        user_id: user.id,
        type: 'TWO_FACTOR_CODE',
        used_at: null,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!emailToken || emailToken.token !== sha256hex(normalizedCode)) {
      throw new UnauthorizedException('Codigo 2FA invalido o expirado');
    }

    await this.prisma.emailToken.update({
      where: { id: emailToken.id },
      data: { used_at: new Date() },
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date(), language },
    });

    const { session, isNewDevice } = await this.createSession(user, context);
    if (isNewDevice) {
      this.notifyNewDeviceLogin(user, session, language);
    }
    return { access_token: this.signAccessToken(user, session) };
  }

  private generateNumericCode(): string {
    const num = randomBytes(4).readUInt32BE(0) % 1000000;
    return String(num).padStart(6, '0');
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

    (user as any).avatar_url = await this.storedFilesService.resolveFileUrl(
      user.avatar_file_id,
    );

    if (user.organization) {
      (user.organization as any).logo_url =
        await this.storedFilesService.resolveFileUrl(
          user.organization.logo_file_id,
        );
    }

    const {
      password_hash,
      two_factor_secret,
      two_factor_backup_codes,
      ...result
    } = user;
    return {
      ...result,
      role: toApiRole(result.role),
      owner_id: result.owner_id,
    };
  }
}
