import {
  hasLegacyOwnerAliases,
  isExternalRole,
  toApiRole,
  toDbRole,
  withOwner,
} from './owner-role-compat';

describe('owner-role contract helpers', () => {
  it('detects legacy owner aliases', () => {
    expect(hasLegacyOwnerAliases({ owner_id: 'owner-1' })).toBe(false);
    expect(hasLegacyOwnerAliases({ company_id: 'owner-1' })).toBe(true);
    expect(hasLegacyOwnerAliases({ customer_id: 'owner-1' })).toBe(true);
  });

  it('does not treat CLIENT as external anymore', () => {
    expect(isExternalRole('EXTERNAL')).toBe(true);
    expect(isExternalRole('CLIENT')).toBe(false);
  });

  it('passes roles through without legacy canonicalization', () => {
    expect(toDbRole('EXTERNAL')).toBe('EXTERNAL');
    expect(toDbRole('CLIENT')).toBe('CLIENT');
    expect(toApiRole('EXTERNAL')).toBe('EXTERNAL');
    expect(toApiRole('CLIENT')).toBe('CLIENT');
  });

  it('returns only owner fields for relation mapping', () => {
    expect(withOwner({ owner_id: 'owner-1', owner: { id: 'owner-1' } })).toEqual({
      owner_id: 'owner-1',
      owner: { id: 'owner-1' },
    });
  });
});
