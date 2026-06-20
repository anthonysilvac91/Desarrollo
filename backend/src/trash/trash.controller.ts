import { Controller, Get, Post, Delete, Param, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { TrashService } from './trash.service';

@ApiTags('Trash')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('trash')
export class TrashController {
  constructor(private readonly trashService: TrashService) {}

  @Get()
  @ApiOperation({ summary: 'Listar elementos en papelera' })
  findAll(
    @Request() req: any,
    @Query('search') search?: string,
    @Query('entity_type') entityType?: string,
    @Query('deleted_by_id') deletedById?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Solo administradores pueden acceder a la papelera');
    }
    return this.trashService.findAll(req.user.orgId, { search, entity_type: entityType, deleted_by_id: deletedById, page, limit });
  }

  @Get('filter-options')
  @ApiOperation({ summary: 'Opciones livianas para filtros de papelera' })
  getFilterOptions(@Request() req: any) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Solo administradores pueden acceder a la papelera');
    }
    return this.trashService.getFilterOptions(req.user.orgId);
  }

  @Post(':entityType/:id/restore')
  @ApiOperation({ summary: 'Restaurar un elemento de la papelera' })
  restore(
    @Param('entityType') entityType: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Solo administradores pueden restaurar elementos');
    }
    return this.trashService.restore(entityType, id, req.user.orgId);
  }

  @Delete(':entityType/:id')
  @ApiOperation({ summary: 'Eliminar permanentemente un elemento de la papelera' })
  permanentDelete(
    @Param('entityType') entityType: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Solo administradores pueden eliminar permanentemente');
    }
    return this.trashService.permanentDelete(entityType, id, req.user.orgId, req.user.id);
  }
}
