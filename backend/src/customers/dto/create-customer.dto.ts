import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ description: 'Nombre de la empresa cliente' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  name: string;

  @ApiProperty({ description: 'Estado activo/inactivo de la empresa', required: false })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
