-- CreateTable: PendingTotpSetup
-- Stores an encrypted TOTP secret for the 2FA setup flow, replacing the
-- practice of embedding the secret directly in the setup JWT payload.
CREATE TABLE "PendingTotpSetup" (
    "id"               TEXT NOT NULL,
    "user_id"          TEXT NOT NULL,
    "encrypted_secret" TEXT NOT NULL,
    "expires_at"       TIMESTAMP(3) NOT NULL,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at"      TIMESTAMP(3),

    CONSTRAINT "PendingTotpSetup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingTotpSetup_user_id_key" ON "PendingTotpSetup"("user_id");
CREATE INDEX "PendingTotpSetup_user_id_idx" ON "PendingTotpSetup"("user_id");
CREATE INDEX "PendingTotpSetup_expires_at_idx" ON "PendingTotpSetup"("expires_at");

-- AddForeignKey
ALTER TABLE "PendingTotpSetup" ADD CONSTRAINT "PendingTotpSetup_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
