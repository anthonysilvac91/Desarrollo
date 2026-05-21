import { BadRequestException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { StoredFilesService } from '../storage/stored-files.service';
import { EmailService } from '../email/email.service';
import { toApiRole } from '../common/compat/owner-role-compat';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private storedFilesService: StoredFilesService,
    private emailService: EmailService,
  ) {}

  async login(loginDto: LoginDto) {
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
      await this.prisma.user.update({
        where: { id: user.id },
        data: { last_login_at: new Date() },
      });
      const payload = { sub: user.id, orgId: null, role: 'SUPER_ADMIN', owner_id: null };
      this.logger.log(`User ${user.id} logged in successfully`);
      return { access_token: this.jwtService.sign(payload) };
    }

    if (!user.organization_id || !user.organization || !user.organization.is_active) {
      this.logger.warn(`User ${user.id} missing or inactive organization`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.role === 'EXTERNAL' && !user.owner_id) {
      this.logger.warn(`EXTERNAL user ${user.id} missing owner_id`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      orgId: user.organization_id,
      role: toApiRole(user.role),
      owner_id: user.owner_id ?? null,
    };

    await this.prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    this.logger.log(`User ${user.id} logged in successfully`);
    return { access_token: this.jwtService.sign(payload) };
  }

  async register(registerDto: RegisterDto) {
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

    const jwtPayload = {
      sub: user.id,
      orgId: user.organization_id,
      role: toApiRole(user.role),
      owner_id: user.owner_id ?? null,
    };

    this.logger.log(`User ${user.id} registered via invitation`);
    return { access_token: this.jwtService.sign(jwtPayload) };
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
    ]);

    this.logger.log(`Password reset completed for user ${emailToken.user_id}`);
    return { message: 'Contraseña actualizada correctamente' };
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

    const { password_hash, ...result } = user;
    return {
      ...result,
      role: toApiRole(result.role),
      owner_id: result.owner_id,
    };
  }
}
