import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TestUtils } from './helpers/test-utils';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';

describe('Dashboard (e2e)', () => {
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

  it('ADMIN debería ver métricas de su propia organización', async () => {
    const org = await testUtils.createTestOrganization('Org1');
    const admin = await testUtils.createTestUser(Role.ADMIN, 'admin@org1.com', org.id);
    
    // Crear datos para la org
    const worker = await testUtils.createTestUser(Role.WORKER, 'worker1@org1.com', org.id);
    await prisma.asset.create({ 
      data: { name: 'Asset 1', organization_id: org.id } 
    });
    const asset = await prisma.asset.findFirst({ where: { organization_id: org.id } });
    await prisma.service.create({ 
      data: { 
        title: 'Service 1', 
        organization_id: org.id, 
        asset_id: asset!.id, 
        worker_id: worker.id,
        is_public: true
      } 
    });

    const token = testUtils.getBearerToken(admin);
    const response = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.total_assets).toBe(1);
    expect(response.body.total_services).toBe(1);
    expect(response.body.public_services).toBe(1);
    expect(response.body.total_workers).toBe(1);
    expect(response.body.recent_services.length).toBe(1);
    expect(response.body.recent_services[0].title).toBe('Service 1');
  });

  it('ADMIN no puede ver métricas de otra organización incluso pasando organizationId', async () => {
    const org1 = await testUtils.createTestOrganization('Org1');
    const org2 = await testUtils.createTestOrganization('Org2');
    const admin1 = await testUtils.createTestUser(Role.ADMIN, 'admin1@org1.com', org1.id);
    
    // Crear datos solo en org2
    await prisma.asset.create({ data: { name: 'Asset 2', organization_id: org2.id } });

    const token = testUtils.getBearerToken(admin1);
    const response = await request(app.getHttpServer())
      .get(`/dashboard?organizationId=${org2.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.total_assets).toBe(0); // El service ignora el organizationId del ADMIN y usa su orgId (org1)
  });

  it('SUPER_ADMIN puede ver métricas globales o filtradas', async () => {
    const org1 = await testUtils.createTestOrganization('Org1');
    const org2 = await testUtils.createTestOrganization('Org2');
    await prisma.asset.create({ data: { name: 'A1', organization_id: org1.id } });
    await prisma.asset.create({ data: { name: 'A2', organization_id: org2.id } });
    
    const superAdmin = await testUtils.createTestUser(Role.SUPER_ADMIN, 'super@recall.com');
    const token = testUtils.getBearerToken(superAdmin);

    // Global
    const resGlobal = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Authorization', `Bearer ${token}`);
    expect(resGlobal.body.total_assets).toBe(2);

    // Filtrado
    const resFiltered = await request(app.getHttpServer())
      .get(`/dashboard?organizationId=${org1.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(resFiltered.body.total_assets).toBe(1);
  });

  it('WORKER debería ver sus propias métricas operativas (no administrativas)', async () => {
    const org = await testUtils.createTestOrganization('Org1');
    const worker = await testUtils.createTestUser(Role.WORKER, 'worker@org1.com', org.id);
    const token = testUtils.getBearerToken(worker);

    const response = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('total_services');
    expect(response.body.total_workers).toBe(0);
    expect(response.body.total_clients).toBe(0);
  });

  it('CLIENT debería ver sus propios activos y servicios públicos (no administrativos)', async () => {
    const org = await testUtils.createTestOrganization('OrgClient');
    const client = await testUtils.createTestUser(Role.CLIENT, 'client@orgclient.com', org.id);
    const token = testUtils.getBearerToken(client);

    const response = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('total_assets');
    expect(response.body.total_workers).toBe(0);
    expect(response.body.total_clients).toBe(0);
    expect(response.body.total_admins).toBe(0);
  });
});
