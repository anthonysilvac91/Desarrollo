import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TestUtils } from './helpers/test-utils';
import { Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

describe('Invitations (e2e)', () => {
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

  describe('POST /invitations', () => {
    it('deberia denegar si es WORKER', async () => {
      const org = await testUtils.createTestOrganization();
      const worker = await testUtils.createTestUser(
        Role.WORKER,
        'worker@test.com',
        org.id,
      );
      const token = testUtils.getBearerToken(worker);

      const res = await request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'new@test.com', role: Role.WORKER });

      expect(res.status).toBe(403);
    });

    it('ADMIN puede invitar internamente a su propia organizacion con fuerza', async () => {
      const org = await testUtils.createTestOrganization();
      const admin = await testUtils.createTestUser(
        Role.ADMIN,
        'admin@test.com',
        org.id,
      );
      const token = testUtils.getBearerToken(admin);

      const res = await request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'worker@test.com', role: Role.WORKER });

      expect(res.status).toBe(201);

      const invBD = await prisma.invitation.findFirst({
        where: { email: 'worker@test.com' },
      });
      expect(invBD?.organization_id).toBe(org.id);
    });

    it('bloquea temporalmente invitacion EXTERNAL', async () => {
      const org = await testUtils.createTestOrganization();
      const admin = await testUtils.createTestUser(
        Role.ADMIN,
        'admin@test.com',
        org.id,
      );
      const token = testUtils.getBearerToken(admin);

      const res = await request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'external@test.com', role: Role.EXTERNAL });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        'External invitations are not available yet',
      );
    });

    it('bloquea temporalmente invitacion EXTERNAL', async () => {
      const org = await testUtils.createTestOrganization();
      const admin = await testUtils.createTestUser(
        Role.ADMIN,
        'admin@test.com',
        org.id,
      );
      const token = testUtils.getBearerToken(admin);

      const res = await request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'external@test.com', role: 'EXTERNAL' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        'External invitations are not available yet',
      );
    });

    it('ADMIN no puede invitar a un SUPER_ADMIN (Forbidden)', async () => {
      const org = await testUtils.createTestOrganization();
      const admin = await testUtils.createTestUser(
        Role.ADMIN,
        'admin@test.com',
        org.id,
      );
      const token = testUtils.getBearerToken(admin);

      const res = await request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'hacker@test.com', role: 'SUPER_ADMIN' });

      expect(res.status).toBe(400);
    });

    it('SUPER_ADMIN puede invitar dictando el organization_id destino', async () => {
      const org = await testUtils.createTestOrganization('Destino');
      const superAdmin = await testUtils.createTestUser(
        Role.SUPER_ADMIN,
        'super@fentri.com',
      );
      const token = testUtils.getBearerToken(superAdmin);

      const res = await request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'worker@destino.com',
          role: Role.WORKER,
          organization_id: org.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.organization_id).toBe(org.id);
    });
  });

  describe('POST /invitations/validate', () => {
    it('deberia retornar datos si el token es valido y no expirado', async () => {
      const org = await testUtils.createTestOrganization();
      const admin = await testUtils.createTestUser(
        Role.ADMIN,
        'admin@test.com',
        org.id,
      );
      const inv = await testUtils.seedTestInvitation(
        org.id,
        'check@check.com',
        Role.EXTERNAL,
        admin.id,
      );

      const res = await request(app.getHttpServer())
        .post('/invitations/validate')
        .send({ token: inv.token });

      expect(res.status).toBe(201);
      expect(res.body.valid).toBe(true);
      expect(res.body.role).toBe('EXTERNAL');
    });
  });
});
