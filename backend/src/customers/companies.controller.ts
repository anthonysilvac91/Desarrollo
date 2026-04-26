import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('companies')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una company' })
  create(@Body() createCustomerDto: CreateCustomerDto, @Request() req) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para crear companies');
    }
    return this.customersService.create(createCustomerDto, req.user.orgId);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las companies de la organización' })
  findAll(@Request() req, @Query() query: PaginationQueryDto) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para listar companies');
    }
    return this.customersService.findAll(req.user.orgId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalles de una company' })
  findOne(@Param('id') id: string, @Request() req) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para ver companies');
    }
    return this.customersService.findOne(id, req.user.orgId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una company' })
  update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto, @Request() req) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para actualizar companies');
    }
    return this.customersService.update(id, updateCustomerDto, req.user.orgId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar logicamente una company' })
  remove(@Param('id') id: string, @Request() req) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para eliminar companies');
    }
    return this.customersService.remove(id, req.user.orgId);
  }
}
