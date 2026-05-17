-- Phase 7.4: drop legacy URL columns after StoredFile *_file_id migration.
-- Do not run before confirming seed and StoredFile-backed uploads are in use.

ALTER TABLE "Organization" DROP COLUMN IF EXISTS "logo_url";
ALTER TABLE "Owner" DROP COLUMN IF EXISTS "logo_url";
ALTER TABLE "User" DROP COLUMN IF EXISTS "avatar_url";
ALTER TABLE "Asset" DROP COLUMN IF EXISTS "thumbnail_url";
ALTER TABLE "ServiceAttachment" DROP COLUMN IF EXISTS "file_url";
