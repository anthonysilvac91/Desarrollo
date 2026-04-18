import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TestUtils } from './helpers/test-utils';
import { Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

describe('Services (e2e)', () => {
  let app: INestApplication;
  let testUtils: TestUtils;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    testUtils = new TestUtils(prisma, jwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await testUtils.clearDatabase();
  });

  describe('Flujos básicos de Services', () => {
    it('WORKER puede crear un service correctamente', async () => {
      const org = await testUtils.createTestOrganization();
      const worker = await testUtils.createTestUser(Role.WORKER, 'worker@test.com', org.id);
      const asset = await prisma.asset.create({ data: { organization_id: org.id, name: 'Bote X' } });
      const token = testUtils.getBearerToken(worker);

      const res = await request(app.getHttpServer())
        .post('/services')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Lavado general', asset_id: asset.id, is_public: false });
      
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Lavado general');
      expect(res.body.worker_id).toBe(worker.id);
    });

    it('CLIENT solo ve services públicos de un Asset asignado', async () => {
      const org = await testUtils.createTestOrganization();
      const worker = await testUtils.createTestUser(Role.WORKER, 'worker@test.com', org.id);
      const client = await testUtils.createTestUser(Role.CLIENT, 'client@test.com', org.id);
      
      const asset = await prisma.asset.create({ data: { organization_id: org.id, name: 'Bote X' } });
      await prisma.clientAssetAccess.create({ data: { client_id: client.id, asset_id: asset.id } });

      await prisma.service.create({ data: { title: 'Público', asset_id: asset.id, worker_id: worker.id, organization_id: org.id, is_public: true }});
      await prisma.service.create({ data: { title: 'Privado', asset_id: asset.id, worker_id: worker.id, organization_id: org.id, is_public: false }});

      const token = testUtils.getBearerToken(client);

      const res = await request(app.getHttpServer())
        .get(`/services?asset_id=${asset.id}`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].title).toBe('Público');
    });

    it('ADMIN puede actualizar un service (editarlo)', async () => {
      const org = await testUtils.createTestOrganization();
      const worker = await testUtils.createTestUser(Role.WORKER, 'worker@test.com', org.id);
      const admin = await testUtils.createTestUser(Role.ADMIN, 'admin@test.com', org.id);
      const asset = await prisma.asset.create({ data: { organization_id: org.id, name: 'Bote X' } });

      const srv = await prisma.service.create({ data: { title: 'Viejo', asset_id: asset.id, worker_id: worker.id, organization_id: org.id, is_public: true }});

      const token = testUtils.getBearerToken(admin);

      const res = await request(app.getHttpServer())
        .patch(`/services/${srv.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Nuevo Título' });
      
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Nuevo Título');
    });
  });
});
