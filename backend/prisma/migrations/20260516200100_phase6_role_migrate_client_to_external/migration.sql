-- Phase 6.1 Step 2: Migrate all CLIENT users to EXTERNAL (canonical DB role)
UPDATE "User" SET role = 'EXTERNAL' WHERE role = 'CLIENT';
