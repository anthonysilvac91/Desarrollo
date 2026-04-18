import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto, ValidateInvitationDto } from './dto/invitations.dto';
import { AuthGuard } from '../auth/auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post()
  @ApiOperation({ summary: 'Crear invitación (Solo ADMIN/SUPER_ADMIN)' })
  create(@Body() dto: CreateInvitationDto, @Request() req) {
    return this.invitationsService.create(dto, req.user.id, req.user.role, req.user.orgId);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validar token de invitación (Público)' })
  validate(@Body() dto: ValidateInvitationDto) {
    return this.invitationsService.validate(dto.token);
  }
}
