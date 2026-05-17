import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { InvitationsService } from './invitations.service';

describe('InvitationsService — MVP disabled', () => {
  let service: InvitationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InvitationsService],
    }).compile();
    service = module.get<InvitationsService>(InvitationsService);
  });

  it('create() devuelve ForbiddenException con mensaje "Invitations are disabled for MVP"', async () => {
    await expect(service.create()).rejects.toThrow(ForbiddenException);
    await expect(service.create()).rejects.toThrow('Invitations are disabled for MVP');
  });

  it('validate() devuelve ForbiddenException con mensaje "Invitations are disabled for MVP"', async () => {
    await expect(service.validate()).rejects.toThrow(ForbiddenException);
    await expect(service.validate()).rejects.toThrow('Invitations are disabled for MVP');
  });
});
