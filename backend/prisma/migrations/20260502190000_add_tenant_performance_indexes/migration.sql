CREATE INDEX "Organization_created_at_idx" ON "Organization"("created_at");

CREATE INDEX "User_organization_id_created_at_idx" ON "User"("organization_id", "created_at");
CREATE INDEX "User_organization_id_role_idx" ON "User"("organization_id", "role");
CREATE INDEX "User_company_id_idx" ON "User"("company_id");

CREATE INDEX "Asset_organization_id_created_at_idx" ON "Asset"("organization_id", "created_at");
CREATE INDEX "Asset_organization_id_company_id_idx" ON "Asset"("organization_id", "company_id");
CREATE INDEX "Asset_company_id_idx" ON "Asset"("company_id");

CREATE INDEX "Service_organization_id_created_at_idx" ON "Service"("organization_id", "created_at");
CREATE INDEX "Service_organization_id_asset_id_idx" ON "Service"("organization_id", "asset_id");
CREATE INDEX "Service_asset_id_created_at_idx" ON "Service"("asset_id", "created_at");
CREATE INDEX "Service_worker_id_created_at_idx" ON "Service"("worker_id", "created_at");

CREATE INDEX "Company_organization_id_created_at_idx" ON "Company"("organization_id", "created_at");

CREATE INDEX "StoredFile_organization_id_kind_idx" ON "StoredFile"("organization_id", "kind");
