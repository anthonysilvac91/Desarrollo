import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TestUtils } from './helpers/test-utils';
import { Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

describe('Organizations (e2e)', () => {
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

  describe('Endpoints SUPER_ADMIN', () => {
    it('debería denegar listar organizaciones si no es SUPER_ADMIN', async () => {
      const org = await testUtils.createTestOrganization();
      const admin = await testUtils.createTestUser(Role.ADMIN, 'admin@org.com', org.id);
      const token = testUtils.getBearerToken(admin);

      const res = await request(app.getHttpServer())
        .get('/organizations')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(403);
    });

    it('debería listar organizaciones si es SUPER_ADMIN', async () => {
      await testUtils.createTestOrganization('Beta');
      await testUtils.createTestOrganization('Gamma');
      const superAdmin = await testUtils.createTestUser(Role.SUPER_ADMIN, 'super@recall.com');
      const token = testUtils.getBearerToken(superAdmin);

      const res = await request(app.getHttpServer())
        .get('/organizations')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
    });

    it('debería crear nueva organización e inicializar invitación como SUPER_ADMIN', async () => {
      const superAdmin = await testUtils.createTestUser(Role.SUPER_ADMIN, 'super@recall.com');
      const token = testUtils.getBearerToken(superAdmin);

      const payload = {
        name: 'Delta Corp',
        slug: 'delta-corp',
        admin_email: 'ceo@delta.com'
      };

      const res = await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.organization.name).toBe('Delta Corp');
      expect(res.body.initial_invitation_token).toBeDefined();

      const savedOrg = await prisma.organization.findUnique({ where: { slug: 'delta-corp' }});
      expect(savedOrg).toBeTruthy();
    });

    it('debería suspender (desactivar) una organización como SUPER_ADMIN', async () => {
      const superAdmin = await testUtils.createTestUser(Role.SUPER_ADMIN, 'super@recall.com');
      const org = await testUtils.createTestOrganization('ToSuspend');
      const token = testUtils.getBearerToken(superAdmin);

      const res = await request(app.getHttpServer())
        .patch(`/organizations/${org.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ is_active: false });

      expect(res.status).toBe(200);
      expect(res.body.is_active).toBe(false);
    });
  });
});
