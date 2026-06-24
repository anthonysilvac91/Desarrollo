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

  describe('POST /assets', () => {
    it('rechaza crear asset sin owner_id', async () => {
      const org = await testUtils.createTestOrganization();
      const admin = await testUtils.createTestUser(
        Role.ADMIN,
        'admin@org.com',
        org.id,
      );
      const token = testUtils.getBearerToken(admin);

      const res = await request(app.getHttpServer())
        .post('/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Bote sin owner' });

      expect(res.status).toBe(400);
    });

    it('crea asset con owner_id valida', async () => {
      const org = await testUtils.createTestOrganization();
      const owner = await testUtils.createTestOwner('Empresa A', org.id);
      const admin = await testUtils.createTestUser(
        Role.ADMIN,
        'admin@org.com',
        org.id,
      );
      const token = testUtils.getBearerToken(admin);

      const res = await request(app.getHttpServer())
        .post('/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Bote con owner', owner_id: owner.id });

      expect(res.status).toBe(201);
      expect(res.body.owner_id).toBe(owner.id);
    });
  });

  describe('GET /assets (Visibilidad Múltiple)', () => {
    it('WORKER no restringido asimila todos los assets de su tenant.', async () => {
      const org = await testUtils.createTestOrganization('Libre', false);
      const owner = await testUtils.createTestOwner('Empresa A', org.id);
      const worker = await testUtils.createTestUser(
        Role.WORKER,
        'worker@libre.com',
        org.id,
      );

      await prisma.asset.createMany({
        data: [
          { organization_id: org.id, owner_id: owner.id, name: 'Bote A' },
          { organization_id: org.id, owner_id: owner.id, name: 'Bote B' },
        ],
      });

      const token = testUtils.getBearerToken(worker);
      const res = await request(app.getHttpServer())
        .get('/assets')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
    });

    it('WORKER restringido solo ve los assets asignados.', async () => {
      const org = await testUtils.createTestOrganization('Restringida', true);
      const owner = await testUtils.createTestOwner('Empresa A', org.id);
      const worker = await testUtils.createTestUser(
        Role.WORKER,
        'worker@restringida.com',
        org.id,
      );

      const assetVinculado = await prisma.asset.create({
        data: {
          organization_id: org.id,
          owner_id: owner.id,
          name: 'Bote Asignado',
        },
      });
      const assetAislado = await prisma.asset.create({
        data: {
          organization_id: org.id,
          owner_id: owner.id,
          name: 'Bote Secreto',
        },
      });

      await prisma.workerAssetAccess.create({
        data: { worker_id: worker.id, asset_id: assetVinculado.id },
      });

      const token = testUtils.getBearerToken(worker);
      const res = await request(app.getHttpServer())
        .get('/assets')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(assetVinculado.id);
    });

    it('EXTERNAL solo ve los assets vinculados a su owner.', async () => {
      const org = await testUtils.createTestOrganization();
      const owner = await testUtils.createTestOwner('Empresa A', org.id);
      const external = await testUtils.createTestUser(
        Role.EXTERNAL,
        'external@org.com',
        org.id,
        owner.id,
      );

      const assetVinculado = await prisma.asset.create({
        data: {
          organization_id: org.id,
          name: 'Bote Owner',
          owner_id: owner.id,
        },
      });
      const otherOwner = await testUtils.createTestOwner('Empresa B', org.id);
      await prisma.asset.create({
        data: {
          organization_id: org.id,
          owner_id: otherOwner.id,
          name: 'Bote Aislado',
        },
      });

      const token = testUtils.getBearerToken(external);
      const res = await request(app.getHttpServer())
        .get('/assets')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(assetVinculado.id);
    });
  });

  describe('GET /assets/:id', () => {
    it('ADMIN puede ver detalle completo con historial y clientes vinculados.', async () => {
      const org = await testUtils.createTestOrganization();
      const owner = await testUtils.createTestOwner('Empresa A', org.id);
      const admin = await testUtils.createTestUser(
        Role.ADMIN,
        'admin@org.com',
        org.id,
      );
      const asset = await prisma.asset.create({
        data: {
          organization_id: org.id,
          owner_id: owner.id,
          name: 'Bote Admin',
        },
      });

      const token = testUtils.getBearerToken(admin);
      const res = await request(app.getHttpServer())
        .get(`/assets/${asset.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Bote Admin');
      expect(res.body.services).toBeDefined();
      expect(res.body.owner).toBeDefined();
    });

    it('No permite ver activos de otro tenant.', async () => {
      const org1 = await testUtils.createTestOrganization('T1');
      const org2 = await testUtils.createTestOrganization('T2');
      const owner2 = await testUtils.createTestOwner('Empresa T2', org2.id);
      const admin1 = await testUtils.createTestUser(
        Role.ADMIN,
        'admin@t1.com',
        org1.id,
      );
      const asset2 = await prisma.asset.create({
        data: {
          organization_id: org2.id,
          owner_id: owner2.id,
          name: 'Bote For�neo',
        },
      });

      const token = testUtils.getBearerToken(admin1);
      const res = await request(app.getHttpServer())
        .get(`/assets/${asset2.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
