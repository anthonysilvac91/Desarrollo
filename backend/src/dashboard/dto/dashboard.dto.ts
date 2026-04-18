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
}
