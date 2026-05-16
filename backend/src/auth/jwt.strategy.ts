import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveOwnerId, toDbRole } from '../common/compat/owner-role-compat';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
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
    const ownerId = resolveOwnerId(payload);
    return {
      id: payload.sub,
      orgId: payload.orgId,
      role: toDbRole(payload.role),
      api_role: payload.role,
      owner_id: ownerId,
      customer_id: ownerId,
      company_id: ownerId,
    };
  }
}
