import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { StoredFilesService } from '../storage/stored-files.service';
import { toApiRole } from '../common/compat/owner-role-compat';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private storedFilesService: StoredFilesService,
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

  async register(_registerDto: any) {
    throw new ForbiddenException('Registration by invitation is disabled for MVP');
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
