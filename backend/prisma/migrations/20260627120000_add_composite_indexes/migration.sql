-- Índices compuestos identificados como ausentes tras análisis de patrones de query.
--
-- Service.(organization_id, worker_id)
--   Usado en: ranking de workers (GROUP BY worker_id WHERE org),
--   COUNT(DISTINCT worker_id) para active_operators del dashboard,
--   y filtro de rol WORKER (WHERE org + worker_id).
--   El índice simple [worker_id] existente no cubre el filtro de tenant.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Service_organization_id_worker_id_idx"
    ON "Service"("organization_id", "worker_id");

-- Service.(organization_id, is_public)
--   Usado en: GROUP BY is_public WHERE organization_id (dashboard public/private counts),
--   y queries de rol EXTERNAL que filtran org + is_public = true.
--   El índice simple [is_public] existente no cubre el filtro de tenant.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Service_organization_id_is_public_idx"
    ON "Service"("organization_id", "is_public");

-- Service.(asset_id, is_public, created_at)
--   Usado en: paginación del historial de servicios para rol EXTERNAL
--   (WHERE asset_id = $1 AND is_public = true ORDER BY created_at DESC TAKE N).
--   El índice [asset_id, created_at] existente no filtra is_public, forzando
--   un filter step adicional sobre todas las filas del activo.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Service_asset_id_is_public_created_at_idx"
    ON "Service"("asset_id", "is_public", "created_at" DESC);

-- User.(organization_id, role, is_active)
--   Usado en: conteo de workers y admins activos en el dashboard
--   (WHERE organization_id AND role = 'WORKER' AND is_active = true).
--   El índice [organization_id, role] existente requiere un filter step
--   adicional para is_active.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_organization_id_role_is_active_idx"
    ON "User"("organization_id", "role", "is_active");
