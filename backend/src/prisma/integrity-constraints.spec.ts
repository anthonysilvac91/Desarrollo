import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Phase 7.1 integrity constraints migration', () => {
  const migrationPath = join(
    __dirname,
    '../../prisma/migrations/20260517000100_phase7_integrity_constraints/migration.sql',
  );

  it('declares the critical DB integrity constraints', () => {
    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('ALTER COLUMN "owner_id" SET NOT NULL');
    expect(sql).toContain('User_role_owner_consistency_chk');
    expect(sql).toContain('Asset_owner_same_organization_fkey');
    expect(sql).toContain('Service_asset_same_organization_fkey');
    expect(sql).toContain('StoredFile_entity_type_chk');
  });
});
