import { Controller, Post, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Invitations')
@Controller('invitations')
export class InvitationsController {
  @Post()
  @ApiOperation({ summary: '[MVP DISABLED] Crear invitación' })
  create() {
    throw new ForbiddenException('Invitations are disabled for MVP');
  }

  @Post('validate')
  @ApiOperation({ summary: '[MVP DISABLED] Validar token de invitación' })
  validate() {
    throw new ForbiddenException('Invitations are disabled for MVP');
  }
}
