-- WA-C1: Add organization_id to WorkerAssetAccess and enforce same-tenant
-- referential integrity via composite foreign keys.
-- Preflight aborts before any schema change if existing data is invalid.

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 0: Unique index on User(id, organization_id) required for composite FK
-- ────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "User_id_organization_id_key"
  ON "User"("id", "organization_id");

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 1: Add organization_id as nullable (backfill before NOT NULL)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE "WorkerAssetAccess" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 2: PREFLIGHT — abort before any data change if invariants are violated
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  cnt_no_worker       INTEGER;
  cnt_no_asset        INTEGER;
  cnt_no_worker_org   INTEGER;
  cnt_cross_tenant    INTEGER;
BEGIN
  -- Grants referencing a non-existent worker
  SELECT COUNT(*) INTO cnt_no_worker
  FROM "WorkerAssetAccess" waa
  LEFT JOIN "User" u ON u."id" = waa."worker_id"
  WHERE u."id" IS NULL;

  IF cnt_no_worker > 0 THEN
    RAISE EXCEPTION
      'WA-C1 preflight failed: % grant(s) with non-existent worker_id. Aborting.',
      cnt_no_worker
      USING ERRCODE = '23503';
  END IF;

  -- Grants referencing a non-existent asset
  SELECT COUNT(*) INTO cnt_no_asset
  FROM "WorkerAssetAccess" waa
  LEFT JOIN "Asset" a ON a."id" = waa."asset_id"
  WHERE a."id" IS NULL;

  IF cnt_no_asset > 0 THEN
    RAISE EXCEPTION
      'WA-C1 preflight failed: % grant(s) with non-existent asset_id. Aborting.',
      cnt_no_asset
      USING ERRCODE = '23503';
  END IF;

  -- Grants where the worker has no organization_id (cannot derive tenant)
  SELECT COUNT(*) INTO cnt_no_worker_org
  FROM "WorkerAssetAccess" waa
  JOIN "User" u ON u."id" = waa."worker_id"
  WHERE u."organization_id" IS NULL;

  IF cnt_no_worker_org > 0 THEN
    RAISE EXCEPTION
      'WA-C1 preflight failed: % grant(s) where worker has no organization_id. Cannot derive tenant. Aborting.',
      cnt_no_worker_org
      USING ERRCODE = '23503';
  END IF;

  -- Cross-tenant grants: worker and asset belong to different organizations
  SELECT COUNT(*) INTO cnt_cross_tenant
  FROM "WorkerAssetAccess" waa
  JOIN "User"  u ON u."id" = waa."worker_id"
  JOIN "Asset" a ON a."id" = waa."asset_id"
  WHERE u."organization_id" <> a."organization_id";

  IF cnt_cross_tenant > 0 THEN
    RAISE EXCEPTION
      'WA-C1 preflight failed: % cross-tenant grant(s) detected (worker.org <> asset.org). Aborting.',
      cnt_cross_tenant
      USING ERRCODE = '23503';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 3: Backfill organization_id from worker's organization
-- Only fills rows where worker exists and has a non-null organization_id
-- and that org matches the asset's org (guaranteed by preflight above).
-- ────────────────────────────────────────────────────────────────────────────
UPDATE "WorkerAssetAccess" waa
SET "organization_id" = u."organization_id"
FROM "User" u
WHERE u."id" = waa."worker_id"
  AND u."organization_id" IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 4: Post-backfill verification — abort if any row is still invalid
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  cnt_null_org     INTEGER;
  cnt_wrong_worker INTEGER;
  cnt_wrong_asset  INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt_null_org
  FROM "WorkerAssetAccess"
  WHERE "organization_id" IS NULL;

  IF cnt_null_org > 0 THEN
    RAISE EXCEPTION
      'WA-C1 post-backfill: % grant(s) still have NULL organization_id. Aborting.',
      cnt_null_org
      USING ERRCODE = '23502';
  END IF;

  SELECT COUNT(*) INTO cnt_wrong_worker
  FROM "WorkerAssetAccess" waa
  JOIN "User" u ON u."id" = waa."worker_id"
  WHERE waa."organization_id" <> u."organization_id";

  IF cnt_wrong_worker > 0 THEN
    RAISE EXCEPTION
      'WA-C1 post-backfill: % grant(s) have organization_id != worker.organization_id. Aborting.',
      cnt_wrong_worker
      USING ERRCODE = '23503';
  END IF;

  SELECT COUNT(*) INTO cnt_wrong_asset
  FROM "WorkerAssetAccess" waa
  JOIN "Asset" a ON a."id" = waa."asset_id"
  WHERE waa."organization_id" <> a."organization_id";

  IF cnt_wrong_asset > 0 THEN
    RAISE EXCEPTION
      'WA-C1 post-backfill: % grant(s) have organization_id != asset.organization_id. Aborting.',
      cnt_wrong_asset
      USING ERRCODE = '23503';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 5: Enforce NOT NULL now that backfill is verified
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE "WorkerAssetAccess" ALTER COLUMN "organization_id" SET NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 6: Drop simple FKs replaced by composite ones
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE "WorkerAssetAccess" DROP CONSTRAINT IF EXISTS "WorkerAssetAccess_worker_id_fkey";
ALTER TABLE "WorkerAssetAccess" DROP CONSTRAINT IF EXISTS "WorkerAssetAccess_asset_id_fkey";

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 7: FK to Organization (ensures org exists)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE "WorkerAssetAccess"
  ADD CONSTRAINT "WorkerAssetAccess_organization_id_fkey"
  FOREIGN KEY ("organization_id")
  REFERENCES "Organization"("id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 8: Composite FK worker_id + organization_id → User(id, organization_id)
-- Requires User_id_organization_id_key created in step 0.
-- Prevents grants from workers in a different org than organization_id.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE "WorkerAssetAccess"
  ADD CONSTRAINT "WorkerAssetAccess_worker_org_fkey"
  FOREIGN KEY ("worker_id", "organization_id")
  REFERENCES "User"("id", "organization_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 9: Composite FK asset_id + organization_id → Asset(id, organization_id)
-- Requires Asset's @@unique([id, organization_id]) (already exists).
-- Prevents grants from assets in a different org than organization_id.
-- Together with step 8, makes cross-tenant grants impossible at the DB level.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE "WorkerAssetAccess"
  ADD CONSTRAINT "WorkerAssetAccess_asset_org_fkey"
  FOREIGN KEY ("asset_id", "organization_id")
  REFERENCES "Asset"("id", "organization_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 10: Index on organization_id for tenant-scoped queries
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "WorkerAssetAccess_organization_id_idx"
  ON "WorkerAssetAccess"("organization_id");
