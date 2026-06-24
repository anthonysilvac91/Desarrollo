-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'UPLOADING', 'UPLOADED', 'CONFIRMED', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttachmentMediaType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "ServiceAttachmentUploadStatus" AS ENUM ('NONE', 'UPLOADING', 'PARTIALLY_READY', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "Organization"
  ADD COLUMN "video_uploads_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "storage_quota_bytes" BIGINT,
  ADD COLUMN "max_video_file_bytes" BIGINT,
  ADD COLUMN "upload_concurrency_limit" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "Service"
  ADD COLUMN "attachment_upload_status" "ServiceAttachmentUploadStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "pending_attachment_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failed_attachment_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ready_attachment_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "attachment_bytes_total" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "attachment_bytes_ready" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ServiceAttachment"
  ADD COLUMN "upload_id" TEXT,
  ADD COLUMN "media_type" "AttachmentMediaType" NOT NULL DEFAULT 'IMAGE',
  ADD COLUMN "duration_seconds" INTEGER,
  ADD COLUMN "width" INTEGER,
  ADD COLUMN "height" INTEGER,
  ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Backfill media type for existing non-image attachments.
UPDATE "ServiceAttachment"
SET "media_type" = CASE
  WHEN "file_type" LIKE 'image/%' THEN 'IMAGE'::"AttachmentMediaType"
  ELSE 'DOCUMENT'::"AttachmentMediaType"
END;

-- CreateTable
CREATE TABLE "FileUpload" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "created_by_user_id" TEXT NOT NULL,
  "storage_ref" TEXT NOT NULL,
  "original_name" TEXT NOT NULL,
  "declared_mime_type" TEXT NOT NULL,
  "detected_mime_type" TEXT,
  "declared_size_bytes" BIGINT NOT NULL,
  "actual_size_bytes" BIGINT,
  "media_type" "AttachmentMediaType" NOT NULL,
  "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
  "signed_token_hash" TEXT,
  "upload_started_at" TIMESTAMP(3),
  "upload_completed_at" TIMESTAMP(3),
  "confirmed_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3) NOT NULL,
  "failure_reason" TEXT,
  "local_progress" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FileUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationStorageUsage" (
  "organization_id" TEXT NOT NULL,
  "ready_bytes" BIGINT NOT NULL DEFAULT 0,
  "reserved_bytes" BIGINT NOT NULL DEFAULT 0,
  "ready_file_count" INTEGER NOT NULL DEFAULT 0,
  "pending_upload_count" INTEGER NOT NULL DEFAULT 0,
  "reconciled_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrganizationStorageUsage_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "MaintenanceJobLock" (
  "name" TEXT NOT NULL,
  "locked_until" TIMESTAMP(3) NOT NULL,
  "locked_by" TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MaintenanceJobLock_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "UploadMaintenanceRun" (
  "id" TEXT NOT NULL,
  "job_name" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "expired_count" INTEGER NOT NULL DEFAULT 0,
  "reconciled_count" INTEGER NOT NULL DEFAULT 0,
  "issue_count" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,

  CONSTRAINT "UploadMaintenanceRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageReconciliationIssue" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "issue_type" TEXT NOT NULL,
  "storage_ref" TEXT,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "detail" TEXT,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StorageReconciliationIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileUpload_storage_ref_key" ON "FileUpload"("storage_ref");
CREATE INDEX "FileUpload_organization_id_status_idx" ON "FileUpload"("organization_id", "status");
CREATE INDEX "FileUpload_service_id_idx" ON "FileUpload"("service_id");
CREATE INDEX "FileUpload_created_by_user_id_idx" ON "FileUpload"("created_by_user_id");
CREATE INDEX "FileUpload_expires_at_idx" ON "FileUpload"("expires_at");
CREATE INDEX "ServiceAttachment_service_id_media_type_idx" ON "ServiceAttachment"("service_id", "media_type");
CREATE UNIQUE INDEX "ServiceAttachment_upload_id_key" ON "ServiceAttachment"("upload_id");
CREATE INDEX "UploadMaintenanceRun_job_name_started_at_idx" ON "UploadMaintenanceRun"("job_name", "started_at");
CREATE INDEX "UploadMaintenanceRun_status_idx" ON "UploadMaintenanceRun"("status");
CREATE INDEX "StorageReconciliationIssue_organization_id_issue_type_idx" ON "StorageReconciliationIssue"("organization_id", "issue_type");
CREATE INDEX "StorageReconciliationIssue_resolved_at_idx" ON "StorageReconciliationIssue"("resolved_at");
CREATE INDEX "StorageReconciliationIssue_created_at_idx" ON "StorageReconciliationIssue"("created_at");

-- AddForeignKey
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceAttachment" ADD CONSTRAINT "ServiceAttachment_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "FileUpload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrganizationStorageUsage" ADD CONSTRAINT "OrganizationStorageUsage_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorageReconciliationIssue" ADD CONSTRAINT "StorageReconciliationIssue_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
