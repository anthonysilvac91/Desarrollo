-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('DEMO', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'SUSPENDED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plan" "PlanTier" NOT NULL DEFAULT 'DEMO',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "max_users" INTEGER NOT NULL DEFAULT 3,
    "max_assets" INTEGER NOT NULL DEFAULT 20,
    "max_storage_gb" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "max_video_hours" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "allow_external" BOOLEAN NOT NULL DEFAULT false,
    "allow_branding" BOOLEAN NOT NULL DEFAULT false,
    "allow_ai_translation" BOOLEAN NOT NULL DEFAULT false,
    "demo_expires_at" TIMESTAMP(3),
    "pending_plan" "PlanTier",
    "pending_plan_requested_at" TIMESTAMP(3),
    "pending_plan_requested_by" TEXT,
    "notes" TEXT,
    "payment_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_organization_id_key" ON "Subscription"("organization_id");

-- CreateIndex
CREATE INDEX "Subscription_plan_idx" ON "Subscription"("plan");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_demo_expires_at_idx" ON "Subscription"("demo_expires_at");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
