import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TestUtils } from './helpers/test-utils';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';

describe('Auth & Register (e2e)', () => {
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

  describe('POST /auth/login', () => {
    it('debería retornar 401 con usuario inexistente', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'fake@example.com', password: '123' });
      expect(response.status).toBe(401);
    });

    it('debería autorizar un usuario válido retornar token', async () => {
      const org = await testUtils.createTestOrganization();
      await testUtils.createTestUser(Role.CLIENT, 'test@test.com', org.id);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@test.com', password: '123456', organizationId: org.id });
      
      expect(response.status).toBe(201);
      expect(response.body.access_token).toBeDefined();
    });
  });

  describe('POST /auth/register', () => {
    it('debería registrar y validar a usuario si manda token válido', async () => {
      const org = await testUtils.createTestOrganization();
      const admin = await testUtils.createTestUser(Role.ADMIN, 'admin@test.com', org.id);
      
      const inv = await testUtils.seedTestInvitation(org.id, 'newcomer@test.com', Role.WORKER, admin.id);

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ token: inv.token, name: 'John Doe', password: 'securepassword123' });

      expect(response.status).toBe(201);
      expect(response.body.access_token).toBeDefined();
      expect(response.body.user.role).toBe(Role.WORKER);
      expect(response.body.user.email).toBe('newcomer@test.com');
      
      // Valida que el token se ha quemado
      const consumido = await prisma.invitation.findUnique({ where: { id: inv.id }});
      expect(consumido?.is_used).toBe(true);
    });

    it('debería arrojar 401 si mandan token usado', async () => {
      const org = await testUtils.createTestOrganization();
      const admin = await testUtils.createTestUser(Role.ADMIN, 'admin@test.com', org.id);
      const inv = await testUtils.seedTestInvitation(org.id, 'newcomer@test.com', Role.WORKER, admin.id, true); // was used

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ token: inv.token, name: 'John Doe', password: 'securepassword123' });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('ya fue utilizada');
    });

    it('debería arrojar 401 si token está vencido', async () => {
      const org = await testUtils.createTestOrganization();
      const admin = await testUtils.createTestUser(Role.ADMIN, 'admin@test.com', org.id);
      const inv = await testUtils.seedTestInvitation(org.id, 'newcomer@test.com', Role.WORKER, admin.id, false, true); // expired

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ token: inv.token, name: 'John', password: 'securepassword' });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('expirado');
    });
  });

  describe('GET /auth/me', () => {
    it('debería fallar (401) si no se envía token', async () => {
      const response = await request(app.getHttpServer()).get('/auth/me');
      expect(response.status).toBe(401);
    });

    it('debería retornar el perfil completo del usuario si el token es válido', async () => {
      const org = await testUtils.createTestOrganization('Branding');
      const user = await testUtils.createTestUser(Role.ADMIN, 'me@test.com', org.id);
      const token = testUtils.getBearerToken(user);

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('me@test.com');
      expect(response.body.role).toBe(Role.ADMIN);
      expect(response.body.organization.slug).toBe(org.slug);
      expect(response.body.password_hash).toBeUndefined(); // Seguridad: NO devolver el hash
    });
  });
});
