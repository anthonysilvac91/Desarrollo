import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvitationDto } from './dto/invitations.dto';
import * as crypto from 'crypto';
import { Role } from '@prisma/client';
import {
  hasConflictingOwnerAliases,
  isExternalRole,
  OWNER_ALIAS_CONFLICT_MESSAGE,
  resolveOwnerId,
  toApiRole,
} from '../common/compat/owner-role-compat';

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(private prisma: PrismaService) {}

  async create(dto: CreateInvitationDto, inviterId: string, inviterRole: string, inviterOrgId?: string) {
    if (dto.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('No se puede invitar a un SUPER_ADMIN');
    }

    if (isExternalRole(dto.role)) {
      throw new BadRequestException('External invitations are not available yet');
    }

    if (hasConflictingOwnerAliases(dto)) {
      throw new BadRequestException(OWNER_ALIAS_CONFLICT_MESSAGE);
    }

    let targetOrgId = dto.organization_id;

    if (inviterRole === 'SUPER_ADMIN') {
      if (!targetOrgId) throw new BadRequestException('El SUPER_ADMIN debe indicar organization_id destino');
    } else if (inviterRole === 'ADMIN') {
      if (!inviterOrgId) throw new BadRequestException('Token invalido: sin organizacion origen');
      targetOrgId = inviterOrgId;
    } else {
      throw new ForbiddenException('No tienes permisos para crear invitaciones');
    }

    const finalOrgId = targetOrgId as string;
    const companyId = resolveOwnerId(dto);

    if (companyId) {
      throw new BadRequestException('Solo una invitacion CLIENT puede asociarse a una company');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await this.prisma.invitation.create({
      data: {
        organization_id: finalOrgId,
        email: dto.email,
        role: dto.role as Role,
        token,
        invited_by_id: inviterId,
        expires_at: expiresAt,
      },
    });

    this.logger.log(`Invitation created for ${dto.email} (Role: ${dto.role}, Org: ${finalOrgId}) by User ${inviterId}`);
    return {
      ...invitation,
      role: toApiRole(invitation.role),
      owner_id: companyId ?? null,
      company_id: companyId ?? null,
      customer_id: companyId ?? null,
    };
  }

  async validate(token: string) {
    const invitation = await this.prisma.invitation.findUnique({ where: { token } });

    if (!invitation) throw new NotFoundException('Invitacion no encontrada');
    if (invitation.is_used) throw new BadRequestException('Esta invitacion ya fue utilizada');
    if (new Date() > invitation.expires_at) throw new BadRequestException('Esta invitacion ha expirado');

    return {
      valid: true,
      email: invitation.email,
      role: toApiRole(invitation.role),
      organization_id: invitation.organization_id,
    };
  }
}
