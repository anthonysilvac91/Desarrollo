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
    it('debería denegar si es WORKER o CLIENT', async () => {
      const org = await testUtils.createTestOrganization();
      const worker = await testUtils.createTestUser(Role.WORKER, 'worker@test.com', org.id);
      const token = testUtils.getBearerToken(worker);

      const res = await request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'new@test.com', role: Role.CLIENT });
      
      expect(res.status).toBe(403);
    });

    it('ADMIN puede invitar a su propia organización con fuerza', async () => {
      const org = await testUtils.createTestOrganization();
      const admin = await testUtils.createTestUser(Role.ADMIN, 'admin@test.com', org.id);
      const token = testUtils.getBearerToken(admin);

      const res = await request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'client@test.com', role: Role.CLIENT }); // Omite org intencionalmente
      
      expect(res.status).toBe(201);
      
      const invBD = await prisma.invitation.findFirst({ where: { email: 'client@test.com' } });
      expect(invBD?.organization_id).toBe(org.id); // Forzado por el backend
    });

    it('ADMIN no puede invitar a un SUPER_ADMIN (Forbidden)', async () => {
      const org = await testUtils.createTestOrganization();
      const admin = await testUtils.createTestUser(Role.ADMIN, 'admin@test.com', org.id);
      const token = testUtils.getBearerToken(admin);

      const res = await request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'hacker@test.com', role: 'SUPER_ADMIN' });
      
      expect(res.status).toBe(400); // Falla por ValidationPipe IsEnum en DTO
    });

    it('SUPER_ADMIN puede invitar dictando el organization_id destino', async () => {
      const org = await testUtils.createTestOrganization('Destino');
      const superAdmin = await testUtils.createTestUser(Role.SUPER_ADMIN, 'super@recall.com');
      const token = testUtils.getBearerToken(superAdmin);

      const res = await request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'worker@destino.com', role: Role.WORKER, organization_id: org.id });
      
      expect(res.status).toBe(201);
      expect(res.body.organization_id).toBe(org.id);
    });
  });

  describe('POST /invitations/validate', () => {
    it('debería retornar datos si el token es válido y no expirado', async () => {
      const org = await testUtils.createTestOrganization();
      const admin = await testUtils.createTestUser(Role.ADMIN, 'admin@test.com', org.id);
      const inv = await testUtils.seedTestInvitation(org.id, 'check@check.com', Role.CLIENT, admin.id);

      const res = await request(app.getHttpServer())
        .post('/invitations/validate')
        .send({ token: inv.token });

      expect(res.status).toBe(201);
      expect(res.body.valid).toBe(true);
      expect(res.body.role).toBe(Role.CLIENT);
    });
  });
});
