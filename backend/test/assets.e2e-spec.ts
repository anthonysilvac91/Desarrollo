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
      const token = await testUtils.getBearerToken(admin);

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
      const token = await testUtils.getBearerToken(admin);

      const res = await request(app.getHttpServer())
        .post('/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Bote con owner', owner_id: owner.id });

      expect(res.status).toBe(201);
      expect(res.body.owner_id).toBe(owner.id);
    });
  });

  describe('GET /assets (Visibilidad Múltiple)', () => {
    it('WORKER no restringido ve todos los assets de su tenant.', async () => {
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

      const token = await testUtils.getBearerToken(worker);
      const res = await request(app.getHttpServer())
        .get('/assets')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
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
      await prisma.asset.create({
        data: {
          organization_id: org.id,
          owner_id: owner.id,
          name: 'Bote Secreto',
        },
      });

      await prisma.workerAssetAccess.create({
        data: {
          worker_id: worker.id,
          asset_id: assetVinculado.id,
          organization_id: org.id,
        },
      });

      const token = await testUtils.getBearerToken(worker);
      const res = await request(app.getHttpServer())
        .get('/assets')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(assetVinculado.id);
    });

    it('WORKER restringido no ve assets de su org sin grant.', async () => {
      const org = await testUtils.createTestOrganization('Estricta', true);
      const owner = await testUtils.createTestOwner('Empresa A', org.id);
      const worker = await testUtils.createTestUser(
        Role.WORKER,
        'worker@estricta.com',
        org.id,
      );

      await prisma.asset.create({
        data: { organization_id: org.id, owner_id: owner.id, name: 'Sin Grant' },
      });

      const token = await testUtils.getBearerToken(worker);
      const res = await request(app.getHttpServer())
        .get('/assets')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });

    it('WORKER nunca ve assets de otra organización.', async () => {
      const orgA = await testUtils.createTestOrganization('OrgA', false);
      const orgB = await testUtils.createTestOrganization('OrgB', false);
      const ownerB = await testUtils.createTestOwner('Empresa B', orgB.id);
      const worker = await testUtils.createTestUser(
        Role.WORKER,
        'worker@orga.com',
        orgA.id,
      );

      await prisma.asset.create({
        data: { organization_id: orgB.id, owner_id: ownerB.id, name: 'Asset OrgB' },
      });

      const token = await testUtils.getBearerToken(worker);
      const res = await request(app.getHttpServer())
        .get('/assets')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
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

      const token = await testUtils.getBearerToken(external);
      const res = await request(app.getHttpServer())
        .get('/assets')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(assetVinculado.id);
    });
  });

  describe('WorkerAssetAccess — Integridad cross-tenant en PostgreSQL', () => {
    it('permite grant con worker, asset y organization_id de la misma org.', async () => {
      const org = await testUtils.createTestOrganization('OrgGrant');
      const owner = await testUtils.createTestOwner('Owner', org.id);
      const worker = await testUtils.createTestUser(
        Role.WORKER,
        'worker@grant.com',
        org.id,
      );
      const asset = await prisma.asset.create({
        data: { organization_id: org.id, owner_id: owner.id, name: 'Asset Grant' },
      });

      await expect(
        prisma.workerAssetAccess.create({
          data: { worker_id: worker.id, asset_id: asset.id, organization_id: org.id },
        }),
      ).resolves.toMatchObject({ worker_id: worker.id, asset_id: asset.id });
    });

    it('rechaza grant con organization_id de la org del worker pero asset de otra org.', async () => {
      const orgA = await testUtils.createTestOrganization('OrgFKA');
      const orgB = await testUtils.createTestOrganization('OrgFKB');
      const ownerB = await testUtils.createTestOwner('OwnerB', orgB.id);
      const worker = await testUtils.createTestUser(
        Role.WORKER,
        'worker@fka.com',
        orgA.id,
      );
      const assetB = await prisma.asset.create({
        data: { organization_id: orgB.id, owner_id: ownerB.id, name: 'Asset B' },
      });

      // organization_id = orgA, pero asset pertenece a orgB → FK asset_org_fkey debe rechazarlo
      await expect(
        prisma.workerAssetAccess.create({
          data: { worker_id: worker.id, asset_id: assetB.id, organization_id: orgA.id },
        }),
      ).rejects.toThrow();
    });

    it('rechaza grant con organization_id de la org del asset pero worker de otra org.', async () => {
      const orgA = await testUtils.createTestOrganization('OrgFKC');
      const orgB = await testUtils.createTestOrganization('OrgFKD');
      const ownerB = await testUtils.createTestOwner('OwnerBD', orgB.id);
      const worker = await testUtils.createTestUser(
        Role.WORKER,
        'worker@fkc.com',
        orgA.id,
      );
      const assetB = await prisma.asset.create({
        data: { organization_id: orgB.id, owner_id: ownerB.id, name: 'Asset BD' },
      });

      // organization_id = orgB, pero worker pertenece a orgA → FK worker_org_fkey debe rechazarlo
      await expect(
        prisma.workerAssetAccess.create({
          data: { worker_id: worker.id, asset_id: assetB.id, organization_id: orgB.id },
        }),
      ).rejects.toThrow();
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

      const token = await testUtils.getBearerToken(admin);
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

      const token = await testUtils.getBearerToken(admin1);
      const res = await request(app.getHttpServer())
        .get(`/assets/${asset2.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
