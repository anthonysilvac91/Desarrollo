import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

describe('AuthService Auth Validations', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwt: JwtService;

  beforeEach(async () => {
    const prismaMock = { user: { findFirst: jest.fn() } };
    const jwtMock = { sign: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwt = module.get<JwtService>(JwtService);
  });

  it('Debería denegar login con usuario no encontrado', async () => {
    jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
    await expect(service.login({ email: 'a@test.com', password: '123', organizationId: 'org' }))
      .rejects.toThrow('Credenciales inválidas');
  });

  it('Debería retornar un token válido si bcrypt aprueba la contraseña', async () => {
    const realHash = await bcrypt.hash('123', 10);
    jest.spyOn(prisma.user, 'findFirst').mockResolvedValue({
      id: 'u-1',
      organization_id: 'org-1',
      role: 'WORKER',
      password_hash: realHash,
    } as any);
    
    jest.spyOn(jwt, 'sign').mockReturnValue('mocked-token');

    const result = await service.login({ email: 'a@test.com', password: '123', organizationId: 'org-1' });

    expect(result.access_token).toBe('mocked-token');
    expect(jwt.sign).toHaveBeenCalledWith({ sub: 'u-1', orgId: 'org-1', role: 'WORKER' });
  });
});
