import { Injectable, ForbiddenException } from '@nestjs/common';

@Injectable()
export class InvitationsService {
  async create() {
    throw new ForbiddenException('Invitations are disabled for MVP');
  }

  async validate() {
    throw new ForbiddenException('Invitations are disabled for MVP');
  }
}
