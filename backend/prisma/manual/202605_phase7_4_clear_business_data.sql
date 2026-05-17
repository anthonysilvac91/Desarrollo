/*
  WARNING: DESTRUCTIVE BUSINESS DATA CLEANUP

  This script deletes Recall business/test data from the current database.
  It preserves schema, enum types, constraints, indexes, and Prisma migration history.

  Intended manual use:
  1. Confirm you are connected to the intended Supabase project.
  2. Run this script in Supabase SQL Editor.
  3. Run the updated Prisma seed from the backend project.

  Explicitly NOT touched:
  - "_prisma_migrations"
  - database schema objects
  - legacy URL columns
*/

BEGIN;

TRUNCATE TABLE
  "ServiceAttachment",
  "WorkerAssetAccess",
  "Service",
  "Asset",
  "Invitation",
  "User",
  "Owner",
  "StoredFile",
  "Organization"
RESTART IDENTITY CASCADE;

COMMIT;
