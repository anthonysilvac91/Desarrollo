import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET;

    if (!secret) {
      throw new Error('CRITICAL ERROR: JWT_SECRET environment variable is missing.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        organization_id: true,
        owner_id: true,
        is_active: true,
        organization: { select: { id: true, is_active: true } },
      },
    });

    if (!user) throw new UnauthorizedException();
    if (!user.is_active) throw new UnauthorizedException();

    if (user.role === 'SUPER_ADMIN') {
      if (user.organization_id !== null) throw new UnauthorizedException();
      return { id: user.id, orgId: null, role: user.role, api_role: user.role, owner_id: null };
    }

    if (!user.organization_id) throw new UnauthorizedException();
    if (!user.organization || !user.organization.is_active) throw new UnauthorizedException();

    if (user.role === 'EXTERNAL') {
      if (!user.owner_id) throw new UnauthorizedException();
      return { id: user.id, orgId: user.organization_id, role: user.role, api_role: user.role, owner_id: user.owner_id };
    }

    return { id: user.id, orgId: user.organization_id, role: user.role, api_role: user.role, owner_id: null };
  }
}
