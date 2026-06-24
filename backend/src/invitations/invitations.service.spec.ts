import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';

const prismaMock = {
  invitation: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  organization: { findUnique: jest.fn() },
  user: { findFirst: jest.fn(), findUnique: jest.fn() },
};

const emailMock = { sendInvitation: jest.fn() };
const configMock = { get: jest.fn().mockReturnValue('http://localhost:3000') };

describe('InvitationsService', () => {
  let service: InvitationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EmailService, useValue: emailMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();
    service = module.get<InvitationsService>(InvitationsService);
    jest.clearAllMocks();
  });

  it('validate() con token inexistente lanza BadRequestException', async () => {
    prismaMock.invitation.findUnique.mockResolvedValue(null);
    await expect(service.validate('bad-token')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('validate() con token válido retorna datos de la invitación', async () => {
    prismaMock.invitation.findUnique.mockResolvedValue({
      email: 'test@test.com',
      role: 'WORKER',
      is_used: false,
      expires_at: new Date(Date.now() + 100000),
      organization: { name: 'Test Org', brand_color: '#000' },
    });
    const result = await service.validate('valid-token');
    expect(result.email).toBe('test@test.com');
  });
});
