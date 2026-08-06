-- AlterTable
ALTER TABLE "UserSession" ADD COLUMN     "country_code" TEXT,
ADD COLUMN     "geo_accuracy_radius" INTEGER,
ADD COLUMN     "geo_resolved_at" TIMESTAMP(3),
ADD COLUMN     "geo_source" TEXT;
