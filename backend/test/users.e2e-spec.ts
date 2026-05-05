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

  describe('POST /users', () => {
    it('SUPER_ADMIN puede crear manualmente el ADMIN inicial asociado a una organizacion', async () => {
      const org = await testUtils.createTestOrganization('ManualAdmin');
      const superAdmin = await testUtils.createTestUser(Role.SUPER_ADMIN, 'super@recall.com');
      const token = testUtils.getBearerToken(superAdmin);

      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'admin@manual.com',
          password: 'SecurePass123!',
          name: 'Initial Admin',
          role: Role.ADMIN,
          organization_id: org.id,
        });

      expect(response.status).toBe(201);
      expect(response.body.role).toBe(Role.ADMIN);
      expect(response.body.organization_id).toBe(org.id);
      expect(response.body.company_id).toBeNull();
      expect(response.body.password_hash).toBeUndefined();

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@manual.com',
          password: 'SecurePass123!',
          organizationId: org.id,
        });

      expect(loginResponse.status).toBe(201);
      expect(loginResponse.body.access_token).toBeDefined();
    });

    it('ADMIN no puede crear usuarios fuera de su organizacion aunque envie otro organization_id', async () => {
      const org1 = await testUtils.createTestOrganization('Org1');
      const org2 = await testUtils.createTestOrganization('Org2');
      const admin = await testUtils.createTestUser(Role.ADMIN, 'admin@org1.com', org1.id);
      const token = testUtils.getBearerToken(admin);

      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'worker@org1.com',
          password: 'SecurePass123!',
          name: 'Worker Org1',
          role: Role.WORKER,
          organization_id: org2.id,
        });

      expect(response.status).toBe(201);
      expect(response.body.role).toBe(Role.WORKER);
      expect(response.body.organization_id).toBe(org1.id);

      const persisted = await prisma.user.findUnique({ where: { id: response.body.id } });
      expect(persisted?.organization_id).toBe(org1.id);
      expect(persisted?.organization_id).not.toBe(org2.id);
    });

    it('rechaza company_id para ADMIN y WORKER', async () => {
      const org = await testUtils.createTestOrganization('Org');
      const company = await testUtils.createTestCustomer('Company', org.id);
      const superAdmin = await testUtils.createTestUser(Role.SUPER_ADMIN, 'super@recall.com');
      const token = testUtils.getBearerToken(superAdmin);

      for (const role of [Role.ADMIN, Role.WORKER]) {
        const response = await request(app.getHttpServer())
          .post('/users')
          .set('Authorization', `Bearer ${token}`)
          .send({
            email: `${role.toLowerCase()}@org.com`,
            password: 'SecurePass123!',
            name: `User ${role}`,
            role,
            organization_id: org.id,
            company_id: company.id,
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Solo un usuario con rol CLIENT puede asociarse a una company');
      }
    });

    it('permite company_id para CLIENT si la company pertenece a la misma organizacion', async () => {
      const org = await testUtils.createTestOrganization('Org');
      const company = await testUtils.createTestCustomer('Company', org.id);
      const admin = await testUtils.createTestUser(Role.ADMIN, 'admin@org.com', org.id);
      const token = testUtils.getBearerToken(admin);

      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'client@org.com',
          password: 'SecurePass123!',
          name: 'Client Org',
          role: Role.CLIENT,
          company_id: company.id,
        });

      expect(response.status).toBe(201);
      expect(response.body.role).toBe(Role.CLIENT);
      expect(response.body.organization_id).toBe(org.id);
      expect(response.body.company_id).toBe(company.id);
    });

    it('valida email, password minimo y role', async () => {
      const org = await testUtils.createTestOrganization('Org');
      const superAdmin = await testUtils.createTestUser(Role.SUPER_ADMIN, 'super@recall.com');
      const token = testUtils.getBearerToken(superAdmin);

      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'invalid-email',
          password: 'short',
          name: 'Invalid User',
          role: 'OWNER',
          organization_id: org.id,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual(expect.any(Array));
      expect(response.body.message).toEqual(expect.arrayContaining([
        expect.stringContaining('Email'),
        expect.stringContaining('8 caracteres'),
        expect.stringContaining('Rol'),
      ]));
    });
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

    it('ADMIN sin organization_id no debe listar usuarios globales', async () => {
      const org = await testUtils.createTestOrganization('Org');
      await testUtils.createTestUser(Role.ADMIN, 'admin@org.com', org.id);
      const invalidAdmin = await testUtils.createTestUser(Role.ADMIN, 'invalid-admin@recall.com');
      const token = testUtils.getBearerToken(invalidAdmin);

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
