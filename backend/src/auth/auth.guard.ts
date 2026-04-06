import { Injectable } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';

@Injectable()
export class AuthGuard extends PassportAuthGuard('jwt') {
  // Reemplazamos los headers mockeados por el guard universal seguro de NestJS/Passport.
}
