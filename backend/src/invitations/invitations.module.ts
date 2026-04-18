import { Module } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [InvitationsController],
  providers: [InvitationsService, PrismaService],
  exports: [InvitationsService]
})
export class InvitationsModule {}
