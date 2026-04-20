import { ApiProperty } from '@nestjs/swagger';

export class RecentServiceDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  title: string;
  @ApiProperty()
  created_at: Date;
  @ApiProperty()
  asset_name: string;
  @ApiProperty()
  worker_name: string;
}

export class EvolutionPointDto {
  @ApiProperty({ description: 'Etiqueta del día (ej: Lun, 15/04)' })
  name: string;
  @ApiProperty({ description: 'Cantidad de servicios' })
  value: number;
}

export class RankingItemDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  metric: number;
  @ApiProperty({ required: false })
  avatar_url?: string;
}

export class DashboardStatsDto {
  @ApiProperty()
  total_assets: number;
  @ApiProperty()
  total_services: number;
  @ApiProperty()
  total_workers: number;
  @ApiProperty()
  total_clients: number;
  @ApiProperty()
  total_admins: number;
  @ApiProperty()
  public_services: number;
  @ApiProperty()
  private_services: number;
  
  @ApiProperty({ type: [RecentServiceDto] })
  recent_services: RecentServiceDto[];

  @ApiProperty({ type: [EvolutionPointDto] })
  evolution: EvolutionPointDto[];

  @ApiProperty({ type: [RankingItemDto] })
  top_assets: RankingItemDto[];

  @ApiProperty({ type: [RankingItemDto] })
  top_clients: RankingItemDto[];

  @ApiProperty({ type: [RankingItemDto] })
  top_workers: RankingItemDto[];
}
