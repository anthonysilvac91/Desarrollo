-- AlterTable
ALTER TABLE "FileUpload" ADD COLUMN     "cf_stream_duration" DOUBLE PRECISION,
ADD COLUMN     "cf_stream_ready_to_stream" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cf_stream_status" TEXT,
ADD COLUMN     "cf_stream_thumbnail" TEXT,
ADD COLUMN     "cf_stream_uid" TEXT,
ADD COLUMN     "cf_stream_upload_url" TEXT;

-- AlterTable
ALTER TABLE "ServiceAttachment" ADD COLUMN     "cf_image_id" TEXT,
ADD COLUMN     "cf_image_variant" TEXT;
