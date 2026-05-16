/*
  Warnings:

  - Made the column `entity_id` on table `StoredFile` required. This step will fail if there are existing NULL values in that column.
  - Made the column `entity_type` on table `StoredFile` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "StoredFile" ALTER COLUMN "entity_id" SET NOT NULL,
ALTER COLUMN "entity_type" SET NOT NULL;
