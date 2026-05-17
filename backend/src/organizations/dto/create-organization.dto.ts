import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @ApiProperty({ description: 'Nombre de la organización.' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
