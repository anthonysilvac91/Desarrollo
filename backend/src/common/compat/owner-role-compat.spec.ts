import {
  hasConflictingOwnerAliases,
  isExternalRole,
  resolveOwnerId,
  toApiRole,
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

  it('prefers owner_id when all aliases are absent or compatible', () => {
    expect(resolveOwnerId({ owner_id: 'owner-1', company_id: 'owner-1', customer_id: 'owner-1' })).toBe('owner-1');
    expect(resolveOwnerId({ company_id: 'owner-2', customer_id: 'owner-2' })).toBe('owner-2');
  });

  it('detects conflicting owner aliases', () => {
    expect(
      hasConflictingOwnerAliases({
        owner_id: 'owner-1',
        company_id: 'owner-2',
      }),
    ).toBe(true);
  });

  describe('toDbRole — Phase 6.1 (EXTERNAL is canonical DB role)', () => {
    it('passes EXTERNAL through unchanged (canonical DB value)', () => {
      expect(toDbRole('EXTERNAL')).toBe('EXTERNAL');
    });

    it('converts legacy CLIENT to EXTERNAL for backward compat with old API clients', () => {
      expect(toDbRole('CLIENT')).toBe('EXTERNAL');
    });

    it('passes other roles through unchanged', () => {
      expect(toDbRole('ADMIN')).toBe('ADMIN');
      expect(toDbRole('WORKER')).toBe('WORKER');
      expect(toDbRole('SUPER_ADMIN')).toBe('SUPER_ADMIN');
    });

    it('passes null and undefined through', () => {
      expect(toDbRole(null)).toBeNull();
      expect(toDbRole(undefined)).toBeUndefined();
    });
  });

  describe('toApiRole — maps legacy DB CLIENT to EXTERNAL for JWT compat', () => {
    it('converts CLIENT (old DB value) to EXTERNAL for API responses', () => {
      expect(toApiRole('CLIENT')).toBe('EXTERNAL');
    });

    it('passes EXTERNAL through unchanged', () => {
      expect(toApiRole('EXTERNAL')).toBe('EXTERNAL');
    });

    it('passes other roles through unchanged', () => {
      expect(toApiRole('ADMIN')).toBe('ADMIN');
      expect(toApiRole('WORKER')).toBe('WORKER');
      expect(toApiRole('SUPER_ADMIN')).toBe('SUPER_ADMIN');
    });

    it('passes null and undefined through', () => {
      expect(toApiRole(null)).toBeNull();
      expect(toApiRole(undefined)).toBeUndefined();
    });
  });

  describe('isExternalRole', () => {
    it('returns true for EXTERNAL', () => {
      expect(isExternalRole('EXTERNAL')).toBe(true);
    });

    it('returns true for CLIENT (legacy alias)', () => {
      expect(isExternalRole('CLIENT')).toBe(true);
    });

    it('returns false for other roles', () => {
      expect(isExternalRole('ADMIN')).toBe(false);
      expect(isExternalRole('WORKER')).toBe(false);
      expect(isExternalRole('SUPER_ADMIN')).toBe(false);
    });

    it('returns false for null and undefined', () => {
      expect(isExternalRole(null)).toBe(false);
      expect(isExternalRole(undefined)).toBe(false);
    });
  });
});
