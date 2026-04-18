import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: loginDto.email,
        ...(loginDto.organizationId ? { organization_id: loginDto.organizationId } : {}),
        is_active: true
      }
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas u organización incorrecta');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = { sub: user.id, orgId: user.organization_id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(registerDto: any) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token: registerDto.token }
    });

    if (!invitation) throw new UnauthorizedException('Token de invitación no válido');
    if (invitation.is_used) throw new UnauthorizedException('Esta invitación ya fue utilizada');
    if (new Date() > invitation.expires_at) throw new UnauthorizedException('Esta invitación ha expirado');

    return this.prisma.$transaction(async (tx) => {
      const passwordHash = await bcrypt.hash(registerDto.password, 10);

      const user = await tx.user.create({
        data: {
          organization_id: invitation.organization_id,
          role: invitation.role,
          email: invitation.email,
          name: registerDto.name,
          password_hash: passwordHash,
        }
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { is_used: true }
      });

      const payload = { sub: user.id, orgId: user.organization_id, role: user.role };
      return {
        access_token: this.jwtService.sign(payload),
        user: { id: user.id, name: user.name, role: user.role, email: user.email }
      };
    });
  }
}

