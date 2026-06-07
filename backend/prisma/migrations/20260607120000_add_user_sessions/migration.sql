-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "token_jti" TEXT NOT NULL,
    "device_name" TEXT,
    "device_type" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_token_jti_key" ON "UserSession"("token_jti");

-- CreateIndex
CREATE INDEX "UserSession_user_id_revoked_at_idx" ON "UserSession"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "UserSession_user_id_last_seen_at_idx" ON "UserSession"("user_id", "last_seen_at");

-- CreateIndex
CREATE INDEX "UserSession_organization_id_idx" ON "UserSession"("organization_id");

-- CreateIndex
CREATE INDEX "UserSession_expires_at_idx" ON "UserSession"("expires_at");

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
