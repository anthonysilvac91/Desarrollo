ALTER TYPE "StoredFileKind" ADD VALUE IF NOT EXISTS 'SERVICE_ATTACHMENT_THUMBNAIL';

ALTER TABLE "ServiceAttachment" ADD COLUMN "thumbnail_file_id" TEXT;

CREATE UNIQUE INDEX "ServiceAttachment_thumbnail_file_id_key" ON "ServiceAttachment"("thumbnail_file_id");

ALTER TABLE "ServiceAttachment" ADD CONSTRAINT "ServiceAttachment_thumbnail_file_id_fkey" FOREIGN KEY ("thumbnail_file_id") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
