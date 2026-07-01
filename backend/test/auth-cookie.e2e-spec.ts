import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Response } from 'supertest';
import { Role } from '@prisma/client';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TestUtils } from './helpers/test-utils';
import { JwtService } from '@nestjs/jwt';

const responseBody = (response: Response): Record<string, unknown> =>
  response.body as Record<string, unknown>;

const sessionCookieFrom = (response: Response): string => {
  const setCookie = response.headers['set-cookie'] as unknown;
  expect(Array.isArray(setCookie)).toBe(true);
  const [sessionCookie] = setCookie as string[];
  expect(sessionCookie).toContain('access_token=');
  expect(sessionCookie).toContain('HttpOnly');
  return sessionCookie;
};

describe('Auth cookie session (e2e)', () => {
  let app: INestApplication;
  let testUtils: TestUtils;
  let server: Parameters<typeof request>[0];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    const prisma = app.get(PrismaService);
    const jwtService = app.get(JwtService);
    testUtils = new TestUtils(prisma, jwtService);
    server = app.getHttpServer() as Parameters<typeof request>[0];
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await testUtils.clearDatabase();
  });

  it('login establece cookie httpOnly y no retorna access_token', async () => {
    const org = await testUtils.createTestOrganization();
    await testUtils.createTestUser(Role.ADMIN, 'admin@test.com', org.id);

    const response = await request(server).post('/auth/login').send({
      email: 'admin@test.com',
      password: '123456',
      organizationId: org.id,
    });

    expect(response.status).toBe(201);
    expect(responseBody(response).access_token).toBeUndefined();
    sessionCookieFrom(response);
  });

  it('/auth/me requiere cookie valida', async () => {
    const org = await testUtils.createTestOrganization();
    await testUtils.createTestUser(Role.ADMIN, 'me@test.com', org.id);

    const unauthenticated = await request(server).get('/auth/me');
    expect(unauthenticated.status).toBe(401);

    const loginResponse = await request(server).post('/auth/login').send({
      email: 'me@test.com',
      password: '123456',
      organizationId: org.id,
    });
    const sessionCookie = sessionCookieFrom(loginResponse);

    const response = await request(server)
      .get('/auth/me')
      .set('Cookie', sessionCookie);

    expect(response.status).toBe(200);
    expect(responseBody(response).email).toBe('me@test.com');
  });

  it('logout revoca la sesion y limpia la cookie', async () => {
    const org = await testUtils.createTestOrganization();
    await testUtils.createTestUser(Role.ADMIN, 'logout@test.com', org.id);

    const loginResponse = await request(server).post('/auth/login').send({
      email: 'logout@test.com',
      password: '123456',
      organizationId: org.id,
    });
    const sessionCookie = sessionCookieFrom(loginResponse);

    const logoutResponse = await request(server)
      .post('/auth/logout')
      .set('Cookie', sessionCookie);

    expect(logoutResponse.status).toBe(201);
    const clearedCookie = sessionCookieFrom(logoutResponse);
    expect(clearedCookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');

    const response = await request(server)
      .get('/auth/me')
      .set('Cookie', sessionCookie);
    expect(response.status).toBe(401);
  });
});
