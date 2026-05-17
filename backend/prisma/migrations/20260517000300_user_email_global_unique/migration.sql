-- Make User.email globally unique (MVP: email único global, sin multi-tenant por email)
-- ADVERTENCIA: Si hay emails duplicados entre organizaciones, esta migración fallará.
-- Verificar con: SELECT email, COUNT(*) FROM "User" GROUP BY email HAVING COUNT(*) > 1;

-- DropIndex
DROP INDEX "User_email_organization_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
