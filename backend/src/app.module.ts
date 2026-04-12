import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { AssetsController } from './assets/assets.controller';
import { AssetsService } from './assets/assets.service';
import { JobsController } from './jobs/jobs.controller';
import { JobsService } from './jobs/jobs.service';
import { OrganizationsController } from './organizations/organizations.controller';
import { OrganizationsService } from './organizations/organizations.service';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    AuthModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
  ],
  controllers: [AppController, AssetsController, JobsController, OrganizationsController],
  providers: [AppService, PrismaService, AssetsService, JobsService, OrganizationsService],
})
export class AppModule {}
