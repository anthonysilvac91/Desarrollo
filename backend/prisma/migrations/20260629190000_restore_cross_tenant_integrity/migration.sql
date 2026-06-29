-- DB-C1: restore tenant-scoped referential integrity for Asset->Owner and Service->Asset.
-- The preflight block intentionally aborts before changing constraints if existing data
-- contains cross-tenant references or orphaned rows.

DO $$
DECLARE
  asset_owner_mismatch_count INTEGER;
  service_asset_mismatch_count INTEGER;
  asset_owner_orphan_count INTEGER;
  service_asset_orphan_count INTEGER;
  owner_pair_duplicate_count INTEGER;
  asset_pair_duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*)
    INTO asset_owner_mismatch_count
  FROM "Asset" a
  JOIN "Owner" o ON o."id" = a."owner_id"
  WHERE a."organization_id" <> o."organization_id";

  IF asset_owner_mismatch_count > 0 THEN
    RAISE EXCEPTION
      'DB-C1 preflight failed: Asset/Owner cross-tenant rows found: %',
      asset_owner_mismatch_count
      USING ERRCODE = '23503';
  END IF;

  SELECT COUNT(*)
    INTO service_asset_mismatch_count
  FROM "Service" s
  JOIN "Asset" a ON a."id" = s."asset_id"
  WHERE s."organization_id" <> a."organization_id";

  IF service_asset_mismatch_count > 0 THEN
    RAISE EXCEPTION
      'DB-C1 preflight failed: Service/Asset cross-tenant rows found: %',
      service_asset_mismatch_count
      USING ERRCODE = '23503';
  END IF;

  SELECT COUNT(*)
    INTO asset_owner_orphan_count
  FROM "Asset" a
  LEFT JOIN "Owner" o ON o."id" = a."owner_id"
  WHERE o."id" IS NULL;

  IF asset_owner_orphan_count > 0 THEN
    RAISE EXCEPTION
      'DB-C1 preflight failed: Asset rows reference missing Owner rows: %',
      asset_owner_orphan_count
      USING ERRCODE = '23503';
  END IF;

  SELECT COUNT(*)
    INTO service_asset_orphan_count
  FROM "Service" s
  LEFT JOIN "Asset" a ON a."id" = s."asset_id"
  WHERE a."id" IS NULL;

  IF service_asset_orphan_count > 0 THEN
    RAISE EXCEPTION
      'DB-C1 preflight failed: Service rows reference missing Asset rows: %',
      service_asset_orphan_count
      USING ERRCODE = '23503';
  END IF;

  SELECT COUNT(*)
    INTO owner_pair_duplicate_count
  FROM (
    SELECT "id", "organization_id"
    FROM "Owner"
    GROUP BY "id", "organization_id"
    HAVING COUNT(*) > 1
  ) duplicates;

  IF owner_pair_duplicate_count > 0 THEN
    RAISE EXCEPTION
      'DB-C1 preflight failed: duplicate Owner(id, organization_id) pairs found: %',
      owner_pair_duplicate_count
      USING ERRCODE = '23505';
  END IF;

  SELECT COUNT(*)
    INTO asset_pair_duplicate_count
  FROM (
    SELECT "id", "organization_id"
    FROM "Asset"
    GROUP BY "id", "organization_id"
    HAVING COUNT(*) > 1
  ) duplicates;

  IF asset_pair_duplicate_count > 0 THEN
    RAISE EXCEPTION
      'DB-C1 preflight failed: duplicate Asset(id, organization_id) pairs found: %',
      asset_pair_duplicate_count
      USING ERRCODE = '23505';
  END IF;
END $$;

ALTER TABLE "Asset" DROP CONSTRAINT IF EXISTS "Asset_owner_id_fkey";
ALTER TABLE "Service" DROP CONSTRAINT IF EXISTS "Service_asset_id_fkey";

ALTER TABLE "Asset"
  ADD CONSTRAINT "Asset_owner_same_organization_fkey"
  FOREIGN KEY ("owner_id", "organization_id")
  REFERENCES "Owner"("id", "organization_id")
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE "Service"
  ADD CONSTRAINT "Service_asset_same_organization_fkey"
  FOREIGN KEY ("asset_id", "organization_id")
  REFERENCES "Asset"("id", "organization_id")
  ON UPDATE CASCADE
  ON DELETE RESTRICT;
