-- Phase 6.7: Drop legacy owner_type / owner_id columns from StoredFile
-- entity_type and entity_id are the canonical fields (NOT NULL since Phase 4).

DROP INDEX IF EXISTS "StoredFile_owner_type_owner_id_idx";

ALTER TABLE "StoredFile" DROP COLUMN "owner_type";
ALTER TABLE "StoredFile" DROP COLUMN "owner_id";
