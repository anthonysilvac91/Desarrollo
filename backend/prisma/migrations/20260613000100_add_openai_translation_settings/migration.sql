ALTER TABLE "Service" ADD COLUMN "description_language" TEXT;

CREATE TABLE "AiProviderSetting" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encrypted_api_key" TEXT,
    "api_key_hint" TEXT,
    "model" TEXT NOT NULL DEFAULT 'gpt-5.4-nano',
    "translations_enabled" BOOLEAN NOT NULL DEFAULT false,
    "translate_services_created_after" TIMESTAMP(3),
    "configured_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProviderSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceTranslation" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "source_hash" TEXT NOT NULL,
    "source_language" TEXT,
    "translated_text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiProviderSetting_provider_key" ON "AiProviderSetting"("provider");
CREATE UNIQUE INDEX "ServiceTranslation_service_id_field_language_key" ON "ServiceTranslation"("service_id", "field", "language");
CREATE INDEX "ServiceTranslation_service_id_idx" ON "ServiceTranslation"("service_id");
CREATE INDEX "ServiceTranslation_language_idx" ON "ServiceTranslation"("language");
CREATE INDEX "ServiceTranslation_source_hash_idx" ON "ServiceTranslation"("source_hash");

ALTER TABLE "ServiceTranslation" ADD CONSTRAINT "ServiceTranslation_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
