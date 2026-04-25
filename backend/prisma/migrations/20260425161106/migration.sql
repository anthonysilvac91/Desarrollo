-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'WORKER', 'CLIENT');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkerEditPolicy" AS ENUM ('ALWAYS_OPEN', 'UNTIL_ADMIN_INTERVENES', 'UNTIL_PUBLISHED', 'TIME_WINDOW');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "logo_url" TEXT,
    "brand_color" TEXT,
    "default_asset_icon" TEXT,
    "auto_publish_services" BOOLEAN NOT NULL DEFAULT true,
    "worker_edit_policy" "WorkerEditPolicy" NOT NULL DEFAULT 'TIME_WINDOW',
    "worker_edit_window_hours" INTEGER,
    "worker_restricted_access" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "role" "Role" NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "avatar_url" TEXT,
    "customer_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "location" TEXT,
    "thumbnail_url" TEXT,
    "serial_number" TEXT,
    "customer_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ServiceStatus" NOT NULL DEFAULT 'COMPLETED',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "admin_intervened" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAttachment" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" TEXT,
    "file_name" TEXT,
    "file_size_bytes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerAssetAccess" (
    "worker_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "granted_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerAssetAccess_pkey" PRIMARY KEY ("worker_id","asset_id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "token" TEXT NOT NULL,
    "invited_by_id" TEXT NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_is_active_idx" ON "Organization"("is_active");

-- CreateIndex
CREATE INDEX "User_organization_id_idx" ON "User"("organization_id");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_is_active_idx" ON "User"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_organization_id_key" ON "User"("email", "organization_id");

-- CreateIndex
CREATE INDEX "Asset_organization_id_idx" ON "Asset"("organization_id");

-- CreateIndex
CREATE INDEX "Asset_is_active_idx" ON "Asset"("is_active");

-- CreateIndex
CREATE INDEX "Service_organization_id_idx" ON "Service"("organization_id");

-- CreateIndex
CREATE INDEX "Service_asset_id_idx" ON "Service"("asset_id");

-- CreateIndex
CREATE INDEX "Service_worker_id_idx" ON "Service"("worker_id");

-- CreateIndex
CREATE INDEX "Service_is_public_idx" ON "Service"("is_public");

-- CreateIndex
CREATE INDEX "Service_created_at_idx" ON "Service"("created_at");

-- CreateIndex
CREATE INDEX "ServiceAttachment_service_id_idx" ON "ServiceAttachment"("service_id");

-- CreateIndex
CREATE INDEX "Customer_organization_id_idx" ON "Customer"("organization_id");

-- CreateIndex
CREATE INDEX "Customer_is_active_idx" ON "Customer"("is_active");

-- CreateIndex
CREATE INDEX "WorkerAssetAccess_worker_id_idx" ON "WorkerAssetAccess"("worker_id");

-- CreateIndex
CREATE INDEX "WorkerAssetAccess_asset_id_idx" ON "WorkerAssetAccess"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_email_organization_id_idx" ON "Invitation"("email", "organization_id");

-- CreateIndex
CREATE INDEX "Invitation_token_idx" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_is_used_idx" ON "Invitation"("is_used");

-- CreateIndex
CREATE INDEX "Invitation_expires_at_idx" ON "Invitation"("expires_at");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAttachment" ADD CONSTRAINT "ServiceAttachment_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAssetAccess" ADD CONSTRAINT "WorkerAssetAccess_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAssetAccess" ADD CONSTRAINT "WorkerAssetAccess_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAssetAccess" ADD CONSTRAINT "WorkerAssetAccess_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
