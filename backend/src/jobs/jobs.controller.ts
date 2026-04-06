import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto';
import { AuthGuard } from '../auth/auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Jobs')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar un trabajo ejecutado', description: 'Crea el trabajo y le adjunta visibilidad configurada instatáneamente por la Organization.' })
  create(@Body() createJobDto: CreateJobDto, @Request() req) {
    return this.jobsService.create(createJobDto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar histórico de trabajos', description: 'Dependiendo del rol que acceda y el param asset, devuelve todo o filtra ocultos.' })
  findAll(@Query() query: ListJobsQueryDto, @Request() req) {
    return this.jobsService.findAll(query, req.user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar un Job (ADMIN MVP)', description: 'Admite modificación de datos, status y visibilidad.' })
  update(@Param('id') id: string, @Body() updateJobDto: UpdateJobDto, @Request() req) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Solo un Admin puede editar los Jobs libremente en esta fase MVP');
    }
    return this.jobsService.update(id, updateJobDto, req.user.orgId);
  }
}
