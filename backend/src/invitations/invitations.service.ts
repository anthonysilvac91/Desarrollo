import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { CreateInvitationDto } from './dto/invitations.dto';
import { Role } from '@prisma/client';

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private config: ConfigService,
  ) {}

  async create(dto: CreateInvitationDto, actor: { id: string; role: string; orgId: string | null }) {
    const organizationId = actor.role === 'SUPER_ADMIN' ? dto.organization_id : actor.orgId;

    if (!organizationId) {
      throw new BadRequestException('organization_id es requerido para SUPER_ADMIN');
    }

    if (dto.role === 'EXTERNAL' && !dto.owner_id) {
      throw new BadRequestException('owner_id es requerido para invitaciones con rol EXTERNAL');
    }

    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org || !org.is_active) {
      throw new BadRequestException('Organización no encontrada o inactiva');
    }

    if (dto.role === 'EXTERNAL' && dto.owner_id) {
      const owner = await this.prisma.owner.findFirst({
        where: { id: dto.owner_id, organization_id: organizationId, is_active: true },
        select: { id: true },
      });
      if (!owner) {
        throw new BadRequestException('El owner indicado no existe o no pertenece a esta organización');
      }
    }

    const existing = await this.prisma.invitation.findFirst({
      where: { email: dto.email, organization_id: organizationId, is_used: false },
    });
    if (existing && existing.expires_at > new Date()) {
      throw new BadRequestException('Ya existe una invitación vigente para este correo');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.email, organization_id: organizationId },
    });
    if (existingUser) {
      throw new BadRequestException('Ya existe un usuario con este correo en la organización');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await this.prisma.invitation.create({
      data: {
        organization_id: organizationId,
        email: dto.email,
        role: dto.role as Role,
        token,
        invited_by_id: actor.id,
        owner_id: dto.owner_id ?? null,
        expires_at: expiresAt,
      },
    });

    const inviter = await this.prisma.user.findUnique({ where: { id: actor.id }, select: { name: true } });
    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    const inviteUrl = `${frontendUrl}/register?token=${token}`;

    await this.emailService.sendInvitation(dto.email, inviter?.name ?? 'Un administrador', org.name, inviteUrl);
    this.logger.log(`Invitation sent to ${dto.email} for org ${organizationId}`);

    return { message: 'Invitación enviada', id: invitation.id };
  }

  async validate(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { organization: { select: { name: true, brand_color: true } } },
    });

    if (!invitation || invitation.is_used || invitation.expires_at < new Date()) {
      throw new BadRequestException('Token de invitación inválido o expirado');
    }

    return {
      email: invitation.email,
      role: invitation.role,
      organization_name: invitation.organization.name,
      brand_color: invitation.organization.brand_color,
    };
  }
}
