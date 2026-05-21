import { Controller, Post, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto, ValidateInvitationDto } from './dto/invitations.dto';
import { AuthGuard } from '../auth/auth.guard';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(private invitationsService: InvitationsService) {}

  @Post()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear invitación y enviar correo al invitado' })
  create(@Body() dto: CreateInvitationDto, @Request() req) {
    const role = req.user.role;
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Solo ADMIN o SUPER_ADMIN pueden invitar usuarios');
    }
    return this.invitationsService.create(dto, { id: req.user.id, role, orgId: req.user.orgId });
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validar token de invitación (público)' })
  validate(@Body() dto: ValidateInvitationDto) {
    return this.invitationsService.validate(dto.token);
  }
}
