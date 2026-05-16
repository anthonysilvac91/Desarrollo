import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from './auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({
    summary: 'Generar token por Tenant',
    description: 'Requiere email, contrasena e ID de Tenant. El JWT devuelve EXTERNAL como rol canonico cuando aplica.',
  })
  @ApiResponse({ status: 201, description: 'Retorna JWT `access_token`' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  @ApiOperation({
    summary: 'Registro mediante token de invitacion',
    description: 'El contrato publico canoniza EXTERNAL.',
  })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario actual' })
  @ApiResponse({ status: 200, description: 'Retorna los datos del usuario autenticado' })
  getMe(@Request() req) {
    return this.authService.getMe(req.user.id);
  }
}
