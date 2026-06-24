import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { Role } from '@prisma/client';
import { UserResponseDto } from './dto/users.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { imageUploadOptions } from '../common/files/multer-image-options';

@ApiTags('Users Management')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Estadisticas de usuarios por rol' })
  getStats(@Request() req: any) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'No tienes permiso para ver estadisticas de usuarios',
      );
    }

    return this.usersService.getStats({
      id: req.user.id,
      role: req.user.role,
      orgId: req.user.orgId,
    });
  }

  @Get()
  @ApiOperation({
    summary: 'Listar usuarios (Solo ADMIN/SUPER_ADMIN)',
    description: 'El filtro role usa EXTERNAL como valor canonico.',
  })
  @ApiQuery({
    name: 'role',
    enum: [...Object.values(Role), 'EXTERNAL'],
    required: false,
  })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Solo para SUPER_ADMIN',
  })
  @ApiQuery({ name: 'isActive', required: false, enum: ['true', 'false'] })
  @ApiResponse({ type: [UserResponseDto] })
  findAll(
    @Request() req: any,
    @Query('role') role?: Role | 'EXTERNAL',
    @Query('organizationId') organizationId?: string,
    @Query('isActive') isActive?: string,
    @Query() pagination?: PaginationQueryDto,
  ) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para listar usuarios');
    }
    return this.usersService.findAll(
      {
        role,
        organizationId,
        isActive,
        search: pagination?.search,
        page: pagination?.page,
        limit: pagination?.limit,
      },
      { id: req.user.id, role: req.user.role, orgId: req.user.orgId },
    );
  }

  @Post()
  @ApiOperation({
    summary: 'Crear nuevo usuario manual',
    description: 'El rol EXTERNAL es canonico.',
  })
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

  @Patch('me')
  @UseInterceptors(
    FileInterceptor('avatar', imageUploadOptions(2 * 1024 * 1024)),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Actualizar el perfil del usuario autenticado' })
  @ApiBody({ type: UpdateOwnProfileDto })
  @ApiResponse({ type: UserResponseDto })
  updateMe(
    @Body() dto: UpdateOwnProfileDto,
    @Request() req: any,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    return this.usersService.updateOwnProfile(
      {
        id: req.user.id,
        role: req.user.role,
        orgId: req.user.orgId,
      },
      dto,
      avatar,
    );
  }

  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('avatar', imageUploadOptions(2 * 1024 * 1024)),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Actualizar perfil de usuario',
    description: 'owner_id es el campo canonico para usuarios externos.',
  })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ type: UserResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Request() req: any,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'No tienes permiso para actualizar usuarios',
      );
    }
    if (avatar) {
      throw new ForbiddenException(
        'Cada usuario debe actualizar su propia foto de perfil',
      );
    }
    return this.usersService.update(id, dto, {
      id: req.user.id,
      role: req.user.role,
      orgId: req.user.orgId,
    });
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Activar/Desactivar usuario',
    description: 'Operacion reservada a administracion interna.',
  })
  @ApiResponse({ type: UserResponseDto })
  toggleStatus(@Param('id') id: string, @Request() req: any) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'No tienes permiso para cambiar el estado de usuarios',
      );
    }
    return this.usersService.toggleStatus(id, {
      id: req.user.id,
      role: req.user.role,
      orgId: req.user.orgId,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar usuario (soft delete)' })
  remove(@Param('id') id: string, @Request() req: any) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para eliminar usuarios');
    }
    return this.usersService.softDelete(id, {
      id: req.user.id,
      role: req.user.role,
      orgId: req.user.orgId,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalle de usuario',
    description:
      'La respuesta devuelve EXTERNAL como rol canonico en usuarios externos.',
  })
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
