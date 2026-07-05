import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsUUID } from 'class-validator';
import { AssetAccessMode } from '@prisma/client';

export class SetAssetAccessDto {
  @ApiProperty({
    type: [String],
    description:
      'IDs de los activos a los que este worker tendra acceso. Reemplaza el conjunto anterior. Ignorado si mode es UNRESTRICTED.',
  })
  @IsArray()
  @IsUUID('4', { each: true, message: 'ID de activo invalido' })
  asset_ids: string[];

  @ApiPropertyOptional({
    enum: AssetAccessMode,
    description:
      'UNRESTRICTED: ve todos los assets de la org. RESTRICTED: solo los de asset_ids (puede quedar vacio).',
  })
  @IsOptional()
  @IsIn(['UNRESTRICTED', 'RESTRICTED'], { message: 'Modo de acceso invalido' })
  mode?: AssetAccessMode;
}
