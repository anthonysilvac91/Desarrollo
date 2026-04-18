import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TestUtils } from './helpers/test-utils';
import { Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

describe('Assets Visibility (e2e)', () => {
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

  describe('GET /assets (Visibilidad Múltiple)', () => {
    it('WORKER no restringido asimila todos los assets de su tenant.', async () => {
      const org = await testUtils.createTestOrganization('Libre', false);
      const worker = await testUtils.createTestUser(Role.WORKER, 'worker@libre.com', org.id);
      
      await prisma.asset.createMany({
        data: [
          { organization_id: org.id, name: 'Bote A' },
          { organization_id: org.id, name: 'Bote B' }
        ]
      });

      const token = testUtils.getBearerToken(worker);
      const res = await request(app.getHttpServer()).get('/assets').set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
    });

    it('WORKER restringido solo ve los assets asignados.', async () => {
      const org = await testUtils.createTestOrganization('Restringida', true);
      const worker = await testUtils.createTestUser(Role.WORKER, 'worker@restringida.com', org.id);
      
      const assetVinculado = await prisma.asset.create({ data: { organization_id: org.id, name: 'Bote Asignado' } });
      const assetAislado = await prisma.asset.create({ data: { organization_id: org.id, name: 'Bote Secreto' } });

      await prisma.workerAssetAccess.create({
        data: { worker_id: worker.id, asset_id: assetVinculado.id }
      });

      const token = testUtils.getBearerToken(worker);
      const res = await request(app.getHttpServer()).get('/assets').set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(assetVinculado.id);
    });

    it('CLIENTE solo ve los assets explícitamente autorizados.', async () => {
      const org = await testUtils.createTestOrganization();
      const client = await testUtils.createTestUser(Role.CLIENT, 'client@org.com', org.id);
      
      const assetVinculado = await prisma.asset.create({ data: { organization_id: org.id, name: 'Bote Cliente' } });
      await prisma.asset.create({ data: { organization_id: org.id, name: 'Bote Aislado' } });

      await prisma.clientAssetAccess.create({
        data: { client_id: client.id, asset_id: assetVinculado.id }
      });

      const token = testUtils.getBearerToken(client);
      const res = await request(app.getHttpServer()).get('/assets').set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(assetVinculado.id);
    });
  });

  describe('GET /assets/:id', () => {
    it('ADMIN puede ver detalle completo con historial y clientes vinculados.', async () => {
      const org = await testUtils.createTestOrganization();
      const admin = await testUtils.createTestUser(Role.ADMIN, 'admin@org.com', org.id);
      const asset = await prisma.asset.create({ data: { organization_id: org.id, name: 'Bote Admin' } });
      
      const token = testUtils.getBearerToken(admin);
      const res = await request(app.getHttpServer()).get(`/assets/${asset.id}`).set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Bote Admin');
      expect(res.body.services).toBeDefined();
      expect(res.body.client_access).toBeDefined();
    });

    it('No permite ver activos de otro tenant.', async () => {
      const org1 = await testUtils.createTestOrganization('T1');
      const org2 = await testUtils.createTestOrganization('T2');
      const admin1 = await testUtils.createTestUser(Role.ADMIN, 'admin@t1.com', org1.id);
      const asset2 = await prisma.asset.create({ data: { organization_id: org2.id, name: 'Bote Foráneo' } });
      
      const token = testUtils.getBearerToken(admin1);
      const res = await request(app.getHttpServer()).get(`/assets/${asset2.id}`).set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(404);
    });
  });
});
