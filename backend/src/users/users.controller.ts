import { Controller, Get, Post, Patch, Body, Query, Param, UseGuards, Request, ForbiddenException, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { Role } from '@prisma/client';
import { UserResponseDto } from './dto/users.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Users Management')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar usuarios (Solo ADMIN/SUPER_ADMIN)' })
  @ApiQuery({ name: 'role', enum: Role, required: false })
  @ApiQuery({ name: 'organizationId', required: false, description: 'Solo para SUPER_ADMIN' })
  @ApiResponse({ type: [UserResponseDto] })
  findAll(
    @Request() req: any,
    @Query('role') role?: Role,
    @Query('organizationId') organizationId?: string,
    @Query() pagination?: PaginationQueryDto
  ) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para listar usuarios');
    }
    return this.usersService.findAll(
      { role, organizationId, search: pagination?.search, page: pagination?.page, limit: pagination?.limit },
      { id: req.user.id, role: req.user.role, orgId: req.user.orgId }
    );
  }

  @Post()
  @ApiOperation({ summary: 'Crear nuevo usuario manual' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, type: UserResponseDto })
  create(@Body() dto: CreateUserDto, @Request() req: any) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para crear usuarios');
    }
    return this.usersService.create(dto, {
      id: req.user.id,
      role: req.user.role,
      orgId: req.user.orgId,
    });
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Actualizar perfil de usuario' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ type: UserResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Request() req: any,
    @UploadedFile() avatar?: Express.Multer.File
  ) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para actualizar usuarios');
    }
    return this.usersService.update(id, dto, {
      id: req.user.id,
      role: req.user.role,
      orgId: req.user.orgId,
    }, avatar);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Activar/Desactivar usuario' })
  @ApiResponse({ type: UserResponseDto })
  toggleStatus(@Param('id') id: string, @Request() req: any) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para cambiar el estado de usuarios');
    }
    return this.usersService.toggleStatus(id, {
      id: req.user.id,
      role: req.user.role,
      orgId: req.user.orgId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de usuario' })
  @ApiResponse({ type: UserResponseDto })
  findOne(@Param('id') id: string, @Request() req: any) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para ver usuarios');
    }
    return this.usersService.findOne(id, {
      id: req.user.id,
      role: req.user.role,
      orgId: req.user.orgId,
    });
  }
}
