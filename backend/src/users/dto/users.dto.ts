import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ required: false, nullable: true })
  organization_id: string | null;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false, nullable: true })
  phone: string | null;

  @ApiProperty({ required: false, nullable: true })
  avatar_url: string | null;

  @ApiProperty()
  is_active: boolean;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}
