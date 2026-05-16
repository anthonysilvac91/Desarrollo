export const EXTERNAL_ROLE = 'EXTERNAL';
export const LEGACY_CLIENT_ROLE = 'CLIENT';

export function isExternalRole(role?: string | null) {
  return role === LEGACY_CLIENT_ROLE || role === EXTERNAL_ROLE;
}

export function toDbRole<T extends string | null | undefined>(role: T): T | 'CLIENT' {
  return role === EXTERNAL_ROLE ? LEGACY_CLIENT_ROLE : role;
}

export function toApiRole<T extends string | null | undefined>(role: T): T | 'EXTERNAL' {
  return role === LEGACY_CLIENT_ROLE ? EXTERNAL_ROLE : role;
}

export type OwnerAliasInput = {
  owner_id?: string | null;
  company_id?: string | null;
  customer_id?: string | null;
};

export const OWNER_ALIAS_CONFLICT_MESSAGE =
  'owner_id, company_id and customer_id must match when provided together';

export function hasConflictingOwnerAliases(input: OwnerAliasInput) {
  const values = [input.owner_id, input.company_id, input.customer_id].filter(
    (value): value is string => value !== undefined && value !== null && value !== '',
  );

  return new Set(values).size > 1;
}

export function resolveOwnerId(input: OwnerAliasInput) {
  return input.owner_id ?? input.company_id ?? input.customer_id ?? null;
}

export function withOwnerAliases<T extends Record<string, any>>(record: T) {
  const ownerId = resolveOwnerId(record);
  const owner = record.owner ?? record.company ?? record.customer ?? null;

  return {
    ...record,
    role: record.role ? toApiRole(record.role) : record.role,
    owner_id: ownerId,
    owner,
    company_id: ownerId,
    company: record.company ?? owner,
    customer_id: ownerId,
    customer: record.customer ?? owner,
  };
}
