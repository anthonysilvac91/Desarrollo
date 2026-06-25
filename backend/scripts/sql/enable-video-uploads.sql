-- =============================================================================
-- HABILITAR VIDEO EN ORGANIZACIONES ACTIVAS
-- Ejecutar manualmente desde Supabase SQL Editor.
-- Idempotente: solo actualiza filas que tengan el flag en false.
-- =============================================================================

-- Preview: ver qué organizaciones se actualizarán
SELECT o.id, o.name, o.is_active, o.video_uploads_enabled, s.plan, s.max_video_hours
FROM "Organization" o
LEFT JOIN "Subscription" s ON s.organization_id = o.id
WHERE o.is_active = true
  AND o.video_uploads_enabled = false;

-- Ejecutar: habilitar video en todas las organizaciones activas
-- UPDATE "Organization"
-- SET video_uploads_enabled = true
-- WHERE is_active = true
--   AND video_uploads_enabled = false;

-- =============================================================================
-- NOTA SOBRE ENTITLEMENTS POR PLAN:
--
-- El flag video_uploads_enabled de Organization es un gate on/off.
-- El entitlement real de video se controla por Subscription.max_video_hours:
--
--   DEMO:       max_video_hours = 0   → no tiene entitlement de video
--   STARTER:    max_video_hours = 0   → no tiene entitlement de video
--   PRO:        max_video_hours = 10  → sí tiene
--   BUSINESS:   max_video_hours = 50  → sí tiene
--   ENTERPRISE: max_video_hours = ∞   → sí tiene
--
-- Sin embargo, la validación actual (UploadPolicyService.validateVideoIntent)
-- solo verifica video_uploads_enabled (org flag) y/o SERVICE_VIDEO_UPLOADS_ENABLED
-- (env var global). NO verifica max_video_hours como gate de autorización.
--
-- Si se quiere que DEMO/STARTER no puedan subir video aunque el flag esté activo,
-- se debe agregar una validación adicional de max_video_hours > 0 en el futuro.
-- =============================================================================
