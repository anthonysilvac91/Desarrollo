import { Controller, Get, Query, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { Role } from '@prisma/client';
import { UserResponseDto } from './dto/users.dto';

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
    @Query('organizationId') organizationId?: string
  ) {
    return this.usersService.findAll(
      { role, organizationId },
      { id: req.user.id, role: req.user.role, orgId: req.user.orgId }
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de usuario' })
  @ApiResponse({ type: UserResponseDto })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.usersService.findOne(id, {
      id: req.user.id,
      role: req.user.role,
      orgId: req.user.orgId,
    });
  }
}
