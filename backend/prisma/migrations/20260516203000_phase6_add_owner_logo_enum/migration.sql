-- Phase 6.6 Step 1: Add OWNER_LOGO to StoredFileKind enum
-- Must run in a separate transaction before any DML that uses the new value.
ALTER TYPE "StoredFileKind" ADD VALUE IF NOT EXISTS 'OWNER_LOGO';
