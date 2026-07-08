import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { EmailService } from './email.service';
import { SendTestEmailDto } from './dto/send-test-email.dto';
import { ToggleTemplateDto } from './dto/toggle-template.dto';

@ApiTags('Email Templates')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('email-templates')
export class EmailTemplatesController {
  constructor(private readonly emailService: EmailService) {}

  @Get()
  @ApiOperation({ summary: 'Listar plantillas de email (Solo SUPER_ADMIN)' })
  findAll(@Request() req) {
    if (req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('No tienes permiso para ver esta sección');
    }
    return this.emailService.listTemplates();
  }

  @Get(':key/preview')
  @ApiOperation({
    summary: 'Previsualizar una plantilla de email (Solo SUPER_ADMIN)',
  })
  preview(
    @Param('key') key: string,
    @Query('lang') lang: string | undefined,
    @Request() req,
  ) {
    if (req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('No tienes permiso para ver esta sección');
    }
    const preview = this.emailService.renderPreview(
      key,
      lang === 'en' ? 'en' : 'es',
    );
    if (!preview) {
      throw new NotFoundException('Plantilla no encontrada');
    }
    return preview;
  }

  @Post(':key/send-test')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({
    summary: 'Enviar una plantilla de prueba a una casilla real (Solo SUPER_ADMIN)',
  })
  async sendTest(
    @Param('key') key: string,
    @Body() dto: SendTestEmailDto,
    @Request() req,
  ) {
    if (req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('No tienes permiso para ver esta sección');
    }
    const sent = await this.emailService.sendTestEmail(
      key,
      dto.to,
      dto.lang === 'en' ? 'en' : 'es',
    );
    if (!sent) {
      throw new BadRequestException(
        'No se pudo enviar la prueba (plantilla no encontrada o el servicio de email no está configurado)',
      );
    }
    return { sent: true };
  }

  @Patch(':key/toggle')
  @ApiOperation({
    summary: 'Habilitar o deshabilitar el envio de una plantilla (Solo SUPER_ADMIN)',
  })
  async toggle(
    @Param('key') key: string,
    @Body() dto: ToggleTemplateDto,
    @Request() req,
  ) {
    if (req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('No tienes permiso para ver esta sección');
    }
    const templates = await this.emailService.listTemplates();
    if (!templates.some((template) => template.key === key)) {
      throw new NotFoundException('Plantilla no encontrada');
    }
    await this.emailService.setTemplateEnabled(key, dto.enabled);
    return { key, enabled: dto.enabled };
  }
}
