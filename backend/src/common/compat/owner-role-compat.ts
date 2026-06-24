export const EXTERNAL_ROLE = 'EXTERNAL';
export const LEGACY_OWNER_ALIAS_MESSAGE =
  'company_id and customer_id are no longer accepted; use owner_id';

export type OwnerInput = {
  owner_id?: string | null;
  company_id?: string | null;
  customer_id?: string | null;
};

export function isExternalRole(role?: string | null) {
  return role === EXTERNAL_ROLE;
}

export function toDbRole<T extends string | null | undefined>(
  role: T,
): T | 'EXTERNAL' {
  return role;
}

export function toApiRole<T extends string | null | undefined>(
  role: T,
): T | 'EXTERNAL' {
  return role;
}

export function hasLegacyOwnerAliases(input: OwnerInput) {
  return input.company_id !== undefined || input.customer_id !== undefined;
}

export function withOwner<T extends Record<string, any>>(record: T) {
  return {
    ...record,
    role: record.role ? toApiRole(record.role) : record.role,
    owner_id: record.owner_id ?? null,
    owner: record.owner ?? null,
  };
}
