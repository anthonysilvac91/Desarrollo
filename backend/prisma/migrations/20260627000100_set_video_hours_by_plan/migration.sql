-- Asignar max_video_hours por plan de suscripcion.
-- DEMO y STARTER no incluyen videos (0 horas).
-- PRO incluye hasta 10 horas de video almacenado.
-- BUSINESS y ENTERPRISE incluyen hasta 100 horas.
-- video_uploads_enabled en Organization queda como override manual de superadmin.

UPDATE "Subscription" SET "max_video_hours" = 0.0  WHERE "plan" IN ('DEMO', 'STARTER');
UPDATE "Subscription" SET "max_video_hours" = 10.0 WHERE "plan" = 'PRO';
UPDATE "Subscription" SET "max_video_hours" = 100.0 WHERE "plan" IN ('BUSINESS', 'ENTERPRISE');
