-- Replace the org-wide "worker_restricted_access" toggle with a per-worker
-- asset access mode, so different workers in the same org can independently
-- be unrestricted, restricted-to-a-list, or restricted-with-nothing-yet.

-- CreateEnum
CREATE TYPE "AssetAccessMode" AS ENUM ('UNRESTRICTED', 'RESTRICTED');

-- AlterTable: User gets its own access mode (default keeps today's behavior)
ALTER TABLE "User" ADD COLUMN "asset_access_mode" "AssetAccessMode" NOT NULL DEFAULT 'UNRESTRICTED';

-- AlterTable: Invitation carries the intended mode + pre-selected assets,
-- applied to the User row once the invitation is accepted.
ALTER TABLE "Invitation" ADD COLUMN "asset_access_mode" "AssetAccessMode" NOT NULL DEFAULT 'UNRESTRICTED';
ALTER TABLE "Invitation" ADD COLUMN "pending_asset_ids" TEXT[] NOT NULL DEFAULT '{}';

-- AlterTable: drop the now-superseded org-wide toggle (never used in production,
-- added and removed within the same development cycle).
ALTER TABLE "Organization" DROP COLUMN "worker_restricted_access";
