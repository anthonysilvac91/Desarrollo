import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { StoredFilesService } from '../storage/stored-files.service';
import {
  hasLegacyOwnerAliases,
  isExternalRole,
  LEGACY_OWNER_ALIAS_MESSAGE,
  toApiRole,
} from '../common/compat/owner-role-compat';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private storedFilesService: StoredFilesService,
  ) {}

  private async ensureOwnerBelongsToOrganization(ownerId: string, organizationId: string) {
    const owner = await this.prisma.owner.findFirst({
      where: { id: ownerId, organization_id: organizationId, is_active: true },
      select: { id: true },
    });

    if (!owner) {
      throw new BadRequestException('El propietario indicado no pertenece a la organización');
    }
  }

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

    this.logger.log(`User ${user.id} logged in successfully`);
    return { access_token: this.jwtService.sign(payload) };
  }

  async register(registerDto: any) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token: registerDto.token },
    });

    if (!invitation) throw new UnauthorizedException('Token de invitación no válido');
    if (invitation.is_used) throw new UnauthorizedException('Esta invitación ya fue utilizada');
    if (new Date() > invitation.expires_at) throw new UnauthorizedException('Esta invitación ha expirado');

    if (hasLegacyOwnerAliases(registerDto)) {
      throw new BadRequestException(LEGACY_OWNER_ALIAS_MESSAGE);
    }
    const ownerId = registerDto.owner_id ?? null;

    if (isExternalRole(invitation.role) && !ownerId) {
      throw new BadRequestException('Un usuario externo debe asociarse a un propietario');
    }

    if (ownerId) {
      if (!isExternalRole(invitation.role)) {
        throw new BadRequestException('Solo un usuario externo puede asociarse a un propietario');
      }

      await this.ensureOwnerBelongsToOrganization(ownerId, invitation.organization_id);
    }

    return this.prisma.$transaction(async (tx) => {
      const passwordHash = await bcrypt.hash(registerDto.password, 10);

      const user = await tx.user.create({
        data: {
          organization_id: invitation.organization_id,
          role: invitation.role,
          email: invitation.email,
          name: registerDto.name,
          password_hash: passwordHash,
          owner_id: ownerId ?? null,
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { is_used: true },
      });

      const payload = {
        sub: user.id,
        orgId: user.organization_id,
        role: toApiRole(user.role),
        owner_id: user.owner_id,
      };

      this.logger.log(`User ${user.id} registered and logged in successfully via invitation`);
      return {
        access_token: this.jwtService.sign(payload),
        user: {
          id: user.id,
          name: user.name,
          role: toApiRole(user.role),
          email: user.email,
          owner_id: user.owner_id,
        },
      };
    });
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, is_active: true },
      include: {
          organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            brand_color: true,
            logo_file_id: true,
            default_asset_icon: true,
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
