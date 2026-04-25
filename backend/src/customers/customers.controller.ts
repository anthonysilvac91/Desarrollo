import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Crear una empresa cliente' })
  create(@Body() createCustomerDto: CreateCustomerDto, @Request() req) {
    return this.customersService.create(createCustomerDto, req.user.orgId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.WORKER)
  @ApiOperation({ summary: 'Obtener todas las empresas clientes de la organización' })
  findAll(@Request() req, @Query() query: PaginationQueryDto) {
    return this.customersService.findAll(req.user.orgId, query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.WORKER)
  @ApiOperation({ summary: 'Obtener detalles de una empresa cliente' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.customersService.findOne(id, req.user.orgId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Actualizar una empresa cliente' })
  update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto, @Request() req) {
    return this.customersService.update(id, updateCustomerDto, req.user.orgId);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Eliminar logicamente una empresa cliente' })
  remove(@Param('id') id: string, @Request() req) {
    return this.customersService.remove(id, req.user.orgId);
  }
}
