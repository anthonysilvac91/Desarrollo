import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'RECALL_MVP_SECRET_KEY', // MVP Local
    });
  }

  async validate(payload: any) {
    // Passport inyectará este objeto en `req.user` para todos los controllers.
    return { id: payload.sub, orgId: payload.orgId, role: payload.role };
  }
}
