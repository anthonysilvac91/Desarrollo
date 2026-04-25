import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ description: 'Nombre de la empresa cliente' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  name: string;
}
