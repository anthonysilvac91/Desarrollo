import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('DB-C1 cross-tenant integrity migration', () => {
  const migrationPath = join(
    __dirname,
    '../../prisma/migrations/20260629190000_restore_cross_tenant_integrity/migration.sql',
  );
  const schemaPath = join(__dirname, '../../prisma/schema.prisma');

  it('restores tenant-scoped composite foreign keys with preflight validation', () => {
    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('Asset_owner_same_organization_fkey');
    expect(sql).toContain('Service_asset_same_organization_fkey');
    expect(sql).toContain('FOREIGN KEY ("owner_id", "organization_id")');
    expect(sql).toContain('REFERENCES "Owner"("id", "organization_id")');
    expect(sql).toContain('FOREIGN KEY ("asset_id", "organization_id")');
    expect(sql).toContain('REFERENCES "Asset"("id", "organization_id")');
    expect(sql).toContain('ON UPDATE CASCADE');
    expect(sql).toContain('ON DELETE RESTRICT');
    expect(sql).toContain('DB-C1 preflight failed');
    expect(sql).toContain('WHERE a."organization_id" <> o."organization_id"');
    expect(sql).toContain('WHERE s."organization_id" <> a."organization_id"');
    expect(sql).not.toContain('CONCURRENTLY');
  });

  it('maps Prisma relations to the restored composite constraints', () => {
    expect(existsSync(schemaPath)).toBe(true);

    const schema = readFileSync(schemaPath, 'utf8');

    expect(schema).toContain(
      '@relation(fields: [owner_id, organization_id], references: [id, organization_id], onDelete: Restrict, onUpdate: Cascade, map: "Asset_owner_same_organization_fkey")',
    );
    expect(schema).toContain(
      '@relation(fields: [asset_id, organization_id], references: [id, organization_id], onDelete: Restrict, onUpdate: Cascade, map: "Service_asset_same_organization_fkey")',
    );
    expect(schema).toContain('@@unique([id, organization_id])');
  });
});
