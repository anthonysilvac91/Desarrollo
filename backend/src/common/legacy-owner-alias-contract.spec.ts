import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from '../auth/dto/register.dto';
import { CreateAssetDto } from '../assets/dto/create-asset.dto';
import { CreateInvitationDto } from '../invitations/dto/invitations.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';

async function validationMessages(dtoClass: new () => object, payload: Record<string, any>) {
  const instance = plainToInstance(dtoClass, payload);
  const errors = await validate(instance);
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('public API owner alias contract', () => {
  it.each([
    ['RegisterDto', RegisterDto],
    ['CreateAssetDto', CreateAssetDto],
    ['CreateInvitationDto', CreateInvitationDto],
    ['CreateUserDto', CreateUserDto],
    ['UpdateUserDto', UpdateUserDto],
  ] as const)('%s rejects company_id', async (_name, dtoClass) => {
    const messages = await validationMessages(dtoClass, { company_id: 'owner-1' });
    expect(messages).toContain('company_id is no longer accepted; use owner_id');
  });

  it.each([
    ['RegisterDto', RegisterDto],
    ['CreateAssetDto', CreateAssetDto],
    ['CreateInvitationDto', CreateInvitationDto],
    ['CreateUserDto', CreateUserDto],
    ['UpdateUserDto', UpdateUserDto],
  ] as const)('%s rejects customer_id', async (_name, dtoClass) => {
    const messages = await validationMessages(dtoClass, { customer_id: 'owner-1' });
    expect(messages).toContain('customer_id is no longer accepted; use owner_id');
  });
});
