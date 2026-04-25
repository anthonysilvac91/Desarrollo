import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { AuthGuard } from '../auth/auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una empresa cliente' })
  create(@Body() createCustomerDto: CreateCustomerDto, @Request() req) {
    return this.customersService.create(createCustomerDto, req.user.orgId);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las empresas clientes de la organización' })
  findAll(@Request() req, @Query() query: PaginationQueryDto) {
    return this.customersService.findAll(req.user.orgId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalles de una empresa cliente' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.customersService.findOne(id, req.user.orgId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una empresa cliente' })
  update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto, @Request() req) {
    return this.customersService.update(id, updateCustomerDto, req.user.orgId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar logicamente una empresa cliente' })
  remove(@Param('id') id: string, @Request() req) {
    return this.customersService.remove(id, req.user.orgId);
  }
}
