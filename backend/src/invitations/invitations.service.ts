import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvitationDto } from './dto/invitations.dto';
import * as crypto from 'crypto';
import { Role } from '@prisma/client';
import { isExternalRole, resolveOwnerId, toApiRole, toDbRole } from '../common/compat/owner-role-compat';

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(private prisma: PrismaService) {}

  private async ensureCompanyBelongsToOrganization(companyId: string, organizationId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, organization_id: organizationId, is_active: true },
      select: { id: true },
    });

    if (!company) {
      throw new BadRequestException('La company indicada no pertenece a la organizaciÃ³n');
    }
  }

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
    const companyId = resolveOwnerId(dto);

    if (isExternalRole(dto.role) && !companyId) {
      throw new BadRequestException('Una invitaciÃ³n CLIENT debe asociarse a una company');
    }

    if (companyId) {
      if (!isExternalRole(dto.role)) {
        throw new BadRequestException('Solo una invitaciÃ³n CLIENT puede asociarse a una company');
      }

      await this.ensureCompanyBelongsToOrganization(companyId, finalOrgId);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await this.prisma.invitation.create({
      data: {
        organization_id: finalOrgId,
        email: dto.email,
        role: toDbRole(dto.role) as Role,
        token: token,
        invited_by_id: inviterId,
        expires_at: expiresAt,
      }
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
    
    if (!invitation) throw new NotFoundException('Invitación no encontrada');
    if (invitation.is_used) throw new BadRequestException('Esta invitación ya fue utilizada');
    if (new Date() > invitation.expires_at) throw new BadRequestException('Esta invitación ha expirado');

    return { 
      valid: true,
      email: invitation.email,
      role: toApiRole(invitation.role),
      organization_id: invitation.organization_id
    };
  }
}
