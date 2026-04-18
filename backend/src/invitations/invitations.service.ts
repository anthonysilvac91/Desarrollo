import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvitationDto } from './dto/invitations.dto';
import * as crypto from 'crypto';

@Injectable()
export class InvitationsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateInvitationDto, inviterId: string, inviterRole: string, inviterOrgId?: string) {
    if (dto.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('No se puede invitar a un SUPER_ADMIN');
    }

    let targetOrgId = dto.organization_id;

    if (inviterRole === 'SUPER_ADMIN') {
      if (!targetOrgId) throw new BadRequestException('El SUPER_ADMIN debe indicar organization_id destino');
    } else if (inviterRole === 'ADMIN') {
      if (!inviterOrgId) throw new BadRequestException('Token inválido: sin organización origen');
      targetOrgId = inviterOrgId; // El Admin solo puede invitar a su propia org
    } else {
      throw new ForbiddenException('No tienes permisos para crear invitaciones');
    }

    const finalOrgId = targetOrgId as string;

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return this.prisma.invitation.create({
      data: {
        organization_id: finalOrgId,
        email: dto.email,
        role: dto.role,
        token: token,
        invited_by_id: inviterId,
        expires_at: expiresAt,
      }
    });
  }

  async validate(token: string) {
    const invitation = await this.prisma.invitation.findUnique({ where: { token } });
    
    if (!invitation) throw new NotFoundException('Invitación no encontrada');
    if (invitation.is_used) throw new BadRequestException('Esta invitación ya fue utilizada');
    if (new Date() > invitation.expires_at) throw new BadRequestException('Esta invitación ha expirado');

    return { 
      valid: true,
      email: invitation.email,
      role: invitation.role,
      organization_id: invitation.organization_id 
    };
  }
}
