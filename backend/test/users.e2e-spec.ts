import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TestUtils } from './helpers/test-utils';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';

describe('Users Management (e2e)', () => {
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

  describe('GET /users', () => {
    it('ADMIN debería ver solo los usuarios de su propia organización', async () => {
      const org1 = await testUtils.createTestOrganization('Org1');
      const org2 = await testUtils.createTestOrganization('Org2');
      
      const admin1 = await testUtils.createTestUser(Role.ADMIN, 'admin1@org1.com', org1.id);
      await testUtils.createTestUser(Role.WORKER, 'worker1@org1.com', org1.id);
      await testUtils.createTestUser(Role.ADMIN, 'admin2@org2.com', org2.id);

      const token = testUtils.getBearerToken(admin1);

      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
      expect(response.body.every(u => u.organization_id === org1.id)).toBe(true);
      expect(response.body[0].password_hash).toBeUndefined();
    });

    it('SUPER_ADMIN debería ver todos los usuarios del sistema por defecto', async () => {
      const org1 = await testUtils.createTestOrganization('Org1');
      const org2 = await testUtils.createTestOrganization('Org2');
      
      await testUtils.createTestUser(Role.ADMIN, 'admin1@org1.com', org1.id);
      await testUtils.createTestUser(Role.ADMIN, 'admin2@org2.com', org2.id);
      const superAdmin = await testUtils.createTestUser(Role.SUPER_ADMIN, 'super@recall.com');

      const token = testUtils.getBearerToken(superAdmin);

      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(3); // admin1, admin2, superAdmin
    });

    it('SUPER_ADMIN puede filtrar por organization_id', async () => {
      const org1 = await testUtils.createTestOrganization('Org1');
      const org2 = await testUtils.createTestOrganization('Org2');
      
      await testUtils.createTestUser(Role.ADMIN, 'admin1@org1.com', org1.id);
      await testUtils.createTestUser(Role.ADMIN, 'admin2@org2.com', org2.id);
      const superAdmin = await testUtils.createTestUser(Role.SUPER_ADMIN, 'super@recall.com');

      const token = testUtils.getBearerToken(superAdmin);

      const response = await request(app.getHttpServer())
        .get(`/users?organizationId=${org1.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].email).toBe('admin1@org1.com');
    });

    it('Cualquier rol puede filtrar por role', async () => {
      const org = await testUtils.createTestOrganization('Org');
      const admin = await testUtils.createTestUser(Role.ADMIN, 'admin@org.com', org.id);
      await testUtils.createTestUser(Role.WORKER, 'worker@org.com', org.id);
      await testUtils.createTestUser(Role.CLIENT, 'client@org.com', org.id);

      const token = testUtils.getBearerToken(admin);

      const response = await request(app.getHttpServer())
        .get(`/users?role=WORKER`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].role).toBe(Role.WORKER);
    });

    it('WORKER debería recibir 403 Forbidden', async () => {
      const org = await testUtils.createTestOrganization('Org');
      const worker = await testUtils.createTestUser(Role.WORKER, 'worker@org.com', org.id);
      const token = testUtils.getBearerToken(worker);

      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /users/:id', () => {
    it('ADMIN puede ver detalle de un usuario de su organización', async () => {
      const org = await testUtils.createTestOrganization('Org');
      const admin = await testUtils.createTestUser(Role.ADMIN, 'admin@org.com', org.id);
      const worker = await testUtils.createTestUser(Role.WORKER, 'worker@org.com', org.id);
      
      const token = testUtils.getBearerToken(admin);

      const response = await request(app.getHttpServer())
        .get(`/users/${worker.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(worker.id);
      expect(response.body.password_hash).toBeUndefined();
    });

    it('ADMIN debería recibir 403 al intentar ver detalle de usuario de otra org', async () => {
      const org1 = await testUtils.createTestOrganization('Org1');
      const org2 = await testUtils.createTestOrganization('Org2');
      
      const admin1 = await testUtils.createTestUser(Role.ADMIN, 'admin1@org1.com', org1.id);
      const admin2 = await testUtils.createTestUser(Role.ADMIN, 'admin2@org2.com', org2.id);
      
      const token = testUtils.getBearerToken(admin1);

      const response = await request(app.getHttpServer())
        .get(`/users/${admin2.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
    });

    it('SUPER_ADMIN puede ver cualquier usuario', async () => {
      const org1 = await testUtils.createTestOrganization('Org1');
      const admin1 = await testUtils.createTestUser(Role.ADMIN, 'admin1@org1.com', org1.id);
      const superAdmin = await testUtils.createTestUser(Role.SUPER_ADMIN, 'super@recall.com');

      const token = testUtils.getBearerToken(superAdmin);

      const response = await request(app.getHttpServer())
        .get(`/users/${admin1.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(admin1.id);
    });
  });
});
