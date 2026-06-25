-- =============================================================================
-- DIAGNÓSTICO DE CUOTAS DE ALMACENAMIENTO
-- Ejecutar desde Supabase SQL Editor o Railway CLI
-- Solo queries de lectura; los fixes están separados y comentados.
-- =============================================================================

-- 1. Organizaciones SIN suscripción
--    Estas organizaciones NO podrán subir archivos hasta que el Super Admin
--    les asigne un plan manualmente desde el drawer.
SELECT o.id, o.name, o.slug, o.is_active
FROM "Organization" o
LEFT JOIN "Subscription" s ON s.organization_id = o.id
WHERE s.id IS NULL
ORDER BY o.name;

-- 2. Organizaciones SIN OrganizationStorageUsage
SELECT o.id, o.name
FROM "Organization" o
LEFT JOIN "OrganizationStorageUsage" u ON u.organization_id = o.id
WHERE u.organization_id IS NULL
ORDER BY o.name;

-- 3. Cuota efectiva por organización
SELECT
  o.id,
  o.name,
  s.plan,
  s.status,
  s.max_storage_gb,
  o.storage_quota_bytes                                    AS org_override_bytes,
  (s.max_storage_gb * 1024 * 1024 * 1024)::bigint         AS plan_quota_bytes,
  COALESCE(
    o.storage_quota_bytes,
    (s.max_storage_gb * 1024 * 1024 * 1024)::bigint
  )                                                        AS effective_quota_bytes,
  COALESCE(u.ready_bytes, 0)                               AS ready_bytes,
  COALESCE(u.reserved_bytes, 0)                            AS reserved_bytes,
  COALESCE(u.ready_bytes, 0) + COALESCE(u.reserved_bytes, 0) AS total_used_bytes
FROM "Organization" o
LEFT JOIN "Subscription" s ON s.organization_id = o.id
LEFT JOIN "OrganizationStorageUsage" u ON u.organization_id = o.id
ORDER BY o.name;

-- 4. Suscripciones cuyo max_storage_gb no coincide con PLAN_LIMITS
--    (indica que se editaron manualmente o migraron mal)
SELECT s.organization_id, o.name, s.plan, s.max_storage_gb,
  CASE s.plan
    WHEN 'DEMO'       THEN 1
    WHEN 'STARTER'    THEN 5
    WHEN 'PRO'        THEN 50
    WHEN 'BUSINESS'   THEN 200
    WHEN 'ENTERPRISE' THEN NULL  -- custom, no hay valor canónico
  END AS expected_storage_gb
FROM "Subscription" s
JOIN "Organization" o ON o.id = s.organization_id
WHERE s.plan != 'ENTERPRISE'
  AND s.max_storage_gb != CASE s.plan
    WHEN 'DEMO'     THEN 1
    WHEN 'STARTER'  THEN 5
    WHEN 'PRO'      THEN 50
    WHEN 'BUSINESS' THEN 200
  END;

-- =============================================================================
-- BACKFILL IDEMPOTENTE: OrganizationStorageUsage
-- Este registro es técnico (no representa decisión comercial).
-- Seguro de ejecutar en producción.
-- =============================================================================
-- INSERT INTO "OrganizationStorageUsage" (
--   organization_id, ready_bytes, reserved_bytes,
--   ready_file_count, pending_upload_count, updated_at
-- )
-- SELECT o.id, 0, 0, 0, 0, NOW()
-- FROM "Organization" o
-- LEFT JOIN "OrganizationStorageUsage" u ON u.organization_id = o.id
-- WHERE u.organization_id IS NULL;

-- =============================================================================
-- FIX: Corregir max_storage_gb que no coincide con plan
-- Solo para planes estándar (no ENTERPRISE).
-- Descomentar y ejecutar SOLO si la query 4 muestra filas.
-- =============================================================================
-- UPDATE "Subscription" SET max_storage_gb = 1     WHERE plan = 'DEMO'       AND max_storage_gb != 1;
-- UPDATE "Subscription" SET max_storage_gb = 5     WHERE plan = 'STARTER'    AND max_storage_gb != 5;
-- UPDATE "Subscription" SET max_storage_gb = 50    WHERE plan = 'PRO'        AND max_storage_gb != 50;
-- UPDATE "Subscription" SET max_storage_gb = 200   WHERE plan = 'BUSINESS'   AND max_storage_gb != 200;

-- =============================================================================
-- NOTA: NO se asigna plan automáticamente a organizaciones sin suscripción.
-- El Super Admin debe asignar cada plan manualmente desde el drawer
-- (POST /subscriptions/:orgId/plan → updatePlan() → upsert).
-- =============================================================================
