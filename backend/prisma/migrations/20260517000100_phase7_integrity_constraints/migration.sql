-- Phase 7.1: critical tenant/model integrity constraints.

ALTER TABLE "Asset"
  ALTER COLUMN "owner_id" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_role_owner_consistency_chk'
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_role_owner_consistency_chk"
      CHECK (
        (role = 'EXTERNAL' AND owner_id IS NOT NULL)
        OR (role IN ('SUPER_ADMIN', 'ADMIN', 'WORKER') AND owner_id IS NULL)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Owner_id_organization_id_key'
  ) THEN
    ALTER TABLE "Owner"
      ADD CONSTRAINT "Owner_id_organization_id_key"
      UNIQUE ("id", "organization_id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Asset_id_organization_id_key'
  ) THEN
    ALTER TABLE "Asset"
      ADD CONSTRAINT "Asset_id_organization_id_key"
      UNIQUE ("id", "organization_id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Asset_owner_same_organization_fkey'
  ) THEN
    ALTER TABLE "Asset"
      ADD CONSTRAINT "Asset_owner_same_organization_fkey"
      FOREIGN KEY ("owner_id", "organization_id")
      REFERENCES "Owner"("id", "organization_id")
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Service_asset_same_organization_fkey'
  ) THEN
    ALTER TABLE "Service"
      ADD CONSTRAINT "Service_asset_same_organization_fkey"
      FOREIGN KEY ("asset_id", "organization_id")
      REFERENCES "Asset"("id", "organization_id")
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StoredFile_entity_type_chk'
  ) THEN
    ALTER TABLE "StoredFile"
      ADD CONSTRAINT "StoredFile_entity_type_chk"
      CHECK (entity_type IN ('ORGANIZATION', 'OWNER', 'USER', 'ASSET', 'SERVICE'));
  END IF;
END $$;
