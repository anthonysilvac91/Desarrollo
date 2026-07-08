import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailTemplatesController } from './email-templates.controller';
import { PrismaService } from '../prisma/prisma.service';

@Global()
@Module({
  controllers: [EmailTemplatesController],
  providers: [EmailService, PrismaService],
  exports: [EmailService],
})
export class EmailModule {}
