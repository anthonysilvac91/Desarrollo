CREATE TABLE "EmailTemplateSetting" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplateSetting_pkey" PRIMARY KEY ("key")
);
