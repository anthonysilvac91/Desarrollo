import { PartialType } from '@nestjs/swagger';
import { CreateOwnerDto } from './create-company.dto';

export class UpdateOwnerDto extends PartialType(CreateOwnerDto) {}
