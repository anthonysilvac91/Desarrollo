import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

function extractJwtFromCookie(req: any): string | null {
  const cookieHeader = req?.headers?.cookie;
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return null;
  }

  const accessTokenCookie = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('access_token='));

  if (!accessTokenCookie) {
    return null;
  }

  return decodeURIComponent(accessTokenCookie.slice('access_token='.length));
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const secret =
      configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET;

    if (!secret) {
      throw new Error(
        'CRITICAL ERROR: JWT_SECRET environment variable is missing.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractJwtFromCookie,
      ]),
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

    if (payload.sid) {
      const session = await this.prisma.userSession.findFirst({
        where: {
          id: payload.sid,
          user_id: user.id,
          token_jti: payload.jti,
          revoked_at: null,
          expires_at: { gt: new Date() },
        },
        select: { id: true },
      });

      if (!session) throw new UnauthorizedException();

      await this.prisma.userSession.update({
        where: { id: session.id },
        data: { last_seen_at: new Date() },
      });
    }

    if (user.role === 'SUPER_ADMIN') {
      if (user.organization_id !== null) throw new UnauthorizedException();
      return {
        id: user.id,
        orgId: null,
        role: user.role,
        api_role: user.role,
        owner_id: null,
        session_id: payload.sid ?? null,
      };
    }

    if (!user.organization_id) throw new UnauthorizedException();
    if (!user.organization || !user.organization.is_active)
      throw new UnauthorizedException();

    if (user.role === 'EXTERNAL') {
      if (!user.owner_id) throw new UnauthorizedException();
      return {
        id: user.id,
        orgId: user.organization_id,
        role: user.role,
        api_role: user.role,
        owner_id: user.owner_id,
        session_id: payload.sid ?? null,
      };
    }

    return {
      id: user.id,
      orgId: user.organization_id,
      role: user.role,
      api_role: user.role,
      owner_id: null,
      session_id: payload.sid ?? null,
    };
  }
}
