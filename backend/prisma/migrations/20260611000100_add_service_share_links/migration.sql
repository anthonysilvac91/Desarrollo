-- CreateTable
CREATE TABLE "ServiceShareLink" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "allow_downloads" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceShareLink_token_key" ON "ServiceShareLink"("token");

-- CreateIndex
CREATE INDEX "ServiceShareLink_service_id_idx" ON "ServiceShareLink"("service_id");

-- CreateIndex
CREATE INDEX "ServiceShareLink_token_idx" ON "ServiceShareLink"("token");

-- CreateIndex
CREATE INDEX "ServiceShareLink_is_enabled_idx" ON "ServiceShareLink"("is_enabled");

-- CreateIndex
CREATE INDEX "ServiceShareLink_expires_at_idx" ON "ServiceShareLink"("expires_at");

-- AddForeignKey
ALTER TABLE "ServiceShareLink" ADD CONSTRAINT "ServiceShareLink_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceShareLink" ADD CONSTRAINT "ServiceShareLink_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
