import { Body, Controller, ForbiddenException, Get, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { UpdateOpenAiSettingsDto } from './ai-settings.dto';
import { AiSettingsService } from './ai-settings.service';

@ApiTags('AI Settings')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('ai-settings')
export class AiSettingsController {
  constructor(private readonly aiSettingsService: AiSettingsService) {}

  @Get('openai')
  @ApiOperation({ summary: 'Obtener configuracion global OpenAI (Solo SUPER_ADMIN)' })
  getOpenAi(@Request() req: any) {
    this.ensureSuperAdmin(req);
    return this.aiSettingsService.getOpenAiSettings();
  }

  @Patch('openai')
  @ApiOperation({ summary: 'Actualizar configuracion global OpenAI (Solo SUPER_ADMIN)' })
  updateOpenAi(@Body() dto: UpdateOpenAiSettingsDto, @Request() req: any) {
    this.ensureSuperAdmin(req);
    return this.aiSettingsService.updateOpenAiSettings(dto, req.user.id);
  }

  @Post('openai/test')
  @ApiOperation({ summary: 'Probar conexion OpenAI (Solo SUPER_ADMIN)' })
  testOpenAi(@Request() req: any) {
    this.ensureSuperAdmin(req);
    return this.aiSettingsService.testOpenAiConnection();
  }

  private ensureSuperAdmin(req: any) {
    if (req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Solo SUPER_ADMIN puede configurar OpenAI');
    }
  }
}
