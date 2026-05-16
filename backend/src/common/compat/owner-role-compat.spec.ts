import {
  hasConflictingOwnerAliases,
  resolveOwnerId,
  toDbRole,
} from './owner-role-compat';

describe('owner-role compat', () => {
  it('accepts repeated owner aliases with the same value', () => {
    expect(
      hasConflictingOwnerAliases({
        owner_id: 'owner-1',
        company_id: 'owner-1',
        customer_id: 'owner-1',
      }),
    ).toBe(false);
    expect(resolveOwnerId({ owner_id: 'owner-1', company_id: 'owner-1' })).toBe('owner-1');
  });

  it('detects conflicting owner aliases', () => {
    expect(
      hasConflictingOwnerAliases({
        owner_id: 'owner-1',
        company_id: 'owner-2',
      }),
    ).toBe(true);
  });

  it('maps EXTERNAL to CLIENT for legacy DB queries', () => {
    expect(toDbRole('EXTERNAL')).toBe('CLIENT');
  });
});
