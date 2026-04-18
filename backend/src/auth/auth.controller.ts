import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Generar token por Tenant', description: 'Requiere email, contraseña e ID de Tenant' })
  @ApiResponse({ status: 201, description: 'Retorna JWT `access_token`' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  @ApiOperation({ summary: 'Registro mediante token de invitación' })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }
}

