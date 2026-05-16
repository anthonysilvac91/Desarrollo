-- Phase 6.1 Step 1: Add EXTERNAL to the Role enum
-- ALTER TYPE ADD VALUE cannot run in the same transaction as DML that uses the new value,
-- so this is a separate migration from the UPDATE below.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'EXTERNAL';
