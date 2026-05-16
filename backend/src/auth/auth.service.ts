import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { StoredFilesService } from '../storage/stored-files.service';
import {
  hasConflictingOwnerAliases,
  isExternalRole,
  OWNER_ALIAS_CONFLICT_MESSAGE,
  resolveOwnerId,
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

  private async ensureCompanyBelongsToOrganization(companyId: string, organizationId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, organization_id: organizationId, is_active: true },
      select: { id: true },
    });

    if (!company) {
      throw new BadRequestException('La company indicada no pertenece a la organizaciÃ³n');
    }
  }

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: loginDto.email,
        ...(loginDto.organizationId ? { organization_id: loginDto.organizationId } : {}),
        is_active: true,
      },
    });

    if (!user) {
      this.logger.warn(`Failed login attempt for email: ${loginDto.email} - User/Org not found`);
      throw new UnauthorizedException('Credenciales inválidas u organización incorrecta');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.password_hash);
    if (!isMatch) {
      this.logger.warn(`Failed login attempt for email: ${loginDto.email} - Invalid credentials`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = {
      sub: user.id,
      orgId: user.organization_id,
      role: toApiRole(user.role),
      legacy_role: user.role,
      owner_id: user.company_id,
      customer_id: user.company_id,
      company_id: user.company_id,
    };

    this.logger.log(`User ${user.id} logged in successfully`);
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(registerDto: any) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token: registerDto.token },
    });

    if (!invitation) throw new UnauthorizedException('Token de invitación no válido');
    if (invitation.is_used) throw new UnauthorizedException('Esta invitación ya fue utilizada');
    if (new Date() > invitation.expires_at) throw new UnauthorizedException('Esta invitación ha expirado');

    if (hasConflictingOwnerAliases(registerDto)) {
      throw new BadRequestException(OWNER_ALIAS_CONFLICT_MESSAGE);
    }
    const companyId = resolveOwnerId(registerDto);

    if (isExternalRole(invitation.role) && !companyId) {
      throw new BadRequestException('Un usuario CLIENT debe asociarse a una company');
    }

    if (companyId) {
      if (!isExternalRole(invitation.role)) {
        throw new BadRequestException('Solo un usuario CLIENT puede asociarse a una company');
      }

      await this.ensureCompanyBelongsToOrganization(companyId, invitation.organization_id);
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
          company_id: companyId ?? null,
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
        legacy_role: user.role,
        owner_id: user.company_id,
        customer_id: user.company_id,
        company_id: user.company_id,
      };

      this.logger.log(`User ${user.id} registered and logged in successfully via invitation`);
      return {
        access_token: this.jwtService.sign(payload),
        user: { id: user.id, name: user.name, role: toApiRole(user.role), email: user.email, owner_id: user.company_id, company_id: user.company_id },
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
            logo_url: true,
            default_asset_icon: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    user.avatar_url = await this.storedFilesService.resolveFileUrlOrRef(
      user.avatar_file_id,
      user.avatar_url,
    );

    if (user.organization) {
      user.organization.logo_url = await this.storedFilesService.resolveFileUrlOrRef(
        user.organization.logo_file_id,
        user.organization.logo_url,
      );
    }

    const { password_hash, ...result } = user;
    return {
      ...result,
      role: toApiRole(result.role),
      owner_id: result.company_id,
      customer_id: result.company_id,
    };
  }
}
