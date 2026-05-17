-- Phase 6: Remove legacy CLIENT role from the physical PostgreSQL enum.
-- Existing data must be canonicalized before recreating the enum.
UPDATE "User" SET role = 'EXTERNAL' WHERE role = 'CLIENT';
UPDATE "Invitation" SET role = 'EXTERNAL' WHERE role = 'CLIENT';

ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'WORKER', 'EXTERNAL');

ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role"
  USING "role"::text::"Role";

ALTER TABLE "Invitation"
  ALTER COLUMN "role" TYPE "Role"
  USING "role"::text::"Role";

DROP TYPE "Role_old";
