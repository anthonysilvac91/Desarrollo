import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { StoredFilesService } from '../storage/stored-files.service';
import * as bcrypt from 'bcryptjs';

describe('AuthService Auth Validations', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwt: JwtService;

  beforeEach(async () => {
    const prismaMock = { user: { findFirst: jest.fn(), findUnique: jest.fn() } };
    const jwtMock = { sign: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: StoredFilesService, useValue: { resolveFileUrlOrRef: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwt = module.get<JwtService>(JwtService);
  });

  it('deniega login con usuario no encontrado', async () => {
    jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
    await expect(service.login({ email: 'a@test.com', password: '123', organizationId: 'org' }))
      .rejects.toThrow('Credenciales');
  });

  it('retorna token con owner_id sin aliases legacy', async () => {
    const realHash = await bcrypt.hash('123', 10);
    jest.spyOn(prisma.user, 'findFirst').mockResolvedValue({
      id: 'u-1',
      organization_id: 'org-1',
      role: 'EXTERNAL',
      password_hash: realHash,
      owner_id: 'owner-1',
    } as any);
    jest.spyOn(jwt, 'sign').mockReturnValue('mocked-token');

    const result = await service.login({ email: 'a@test.com', password: '123', organizationId: 'org-1' });

    expect(result.access_token).toBe('mocked-token');
    expect(jwt.sign).toHaveBeenCalledWith({
      sub: 'u-1',
      orgId: 'org-1',
      role: 'EXTERNAL',
      owner_id: 'owner-1',
    });
  });

  it('getMe devuelve owner_id sin company_id/customer_id', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'u-3',
      organization_id: 'org-3',
      role: 'EXTERNAL',
      password_hash: 'hash',
      owner_id: 'owner-2',
      avatar_file_id: null,
      avatar_url: null,
      organization: null,
    } as any);
    jest.spyOn((service as any).storedFilesService, 'resolveFileUrlOrRef').mockResolvedValue(null);

    const result = await service.getMe('u-3');

    expect(result.role).toBe('EXTERNAL');
    expect(result.owner_id).toBe('owner-2');
    expect((result as any).company_id).toBeUndefined();
    expect((result as any).customer_id).toBeUndefined();
  });
});
