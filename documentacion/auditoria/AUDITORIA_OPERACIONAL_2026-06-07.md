# Auditoría Operacional de Producción — Recall

**Fecha:** 2026-06-07
**Ejecutor:** Claude Code (análisis estático + revisión de código)
**Método:** Revisión de código, historial de migraciones y configuración. Sin acceso a dashboards de Railway/Vercel ni a DB de producción directamente. Sin modificación de datos, variables ni código.

---

## 1. Resumen Ejecutivo

| | |
|---|---|
| **Estado general** | Apto para operar con 1 cliente existente. Existen riesgos silenciosos a resolver antes de sumar más tenants. |
| **Riesgo actual** | **Medio** |
| **¿Apto para 1 cliente?** | **Sí**, con las deudas aceptadas documentadas. |
| **¿Apto para 2–4 clientes más?** | **Sí, con condiciones**: corregir los 2 ítems bloqueantes identificados primero. |

**Principales riesgos silenciosos encontrados:**

1. `RESEND_API_KEY` y `FRONTEND_URL` **no están validadas al inicio en producción** — el backend arranca sin ellas y cualquier flujo de email (forgot-password, invitaciones) retorna 500 en lugar de degradarse graciosamente.
2. Migración `20260607043818_init_local` con nombre de artefacto local comprometida en el historial de migraciones — requiere verificación de sincronía con la DB de producción.
3. Cookie `access_token` seteada en `AuthContext.tsx` **sin flag `secure`**, inconsistente con `auth.ts` que sí lo aplica.
4. **No existe limpieza automática de archivos huérfanos** en Supabase Storage.
5. Estado de backups de Supabase **requiere verificación manual** del plan activo.

---

## 2. Hallazgos

| ID | Severidad | Área | Hallazgo | Evidencia | Impacto | Acción recomendada |
|---|---|---|---|---|---|---|
| H-01 | **Alta** | Config / Email | `RESEND_API_KEY` y `FRONTEND_URL` no incluidas en `requireProductionEnv`. Si están ausentes, el backend arranca y los endpoints `/auth/forgot-password` e `/invitations` lanzan **HTTP 500** (no hay try/catch alrededor del `emailService.send*` en esas rutas). | `main.ts:14–30`; `auth.service.ts:forgotPassword`; `invitations.service.ts:create` | Usuario recibe 500 en vez de mensaje amigable. URL del token de reset sería `undefined/reset-password?token=…` si falta `FRONTEND_URL`. | Agregar `RESEND_API_KEY` y `FRONTEND_URL` a `requireProductionEnv`, o envolver las llamadas de email en try/catch con degradación graceful. |
| H-02 | **Alta** | Migraciones | La migración `20260607043818_init_local` existe en el historial con nombre de artefacto local. Su contenido (`DROP INDEX "User_two_factor_enabled_idx"`) es coherente pero el nombre sugiere que fue generada con `prisma migrate dev` en entorno local y comprometida accidentalmente. | `backend/prisma/migrations/20260607043818_init_local/migration.sql` | Si producción aplicó `add_user_two_factor` pero no `init_local`, hay un índice fantasma. Si produjo divergencia, `prisma migrate deploy` podría fallar en el próximo deploy. | Verificar en Supabase SQL Editor: `SELECT * FROM "_prisma_migrations" WHERE migration_name LIKE '%init_local%';`. Confirmar que está marcada como `applied`. |
| H-03 | **Media** | Auth / Cookie | `AuthContext.tsx:75` setea la cookie `access_token` sin `secure: true` ni `sameSite`, inconsistente con `auth.ts:5` que sí usa `secure: isProduction`. | `frontend/src/lib/AuthContext.tsx:75`; `frontend/src/lib/auth.ts:5` | En producción la cookie se transmite por HTTPS igual, pero la inconsistencia indica que `auth.ts` no es la única ruta de set. `AuthContext` es la ruta principal (login). | Unificar en `AuthContext.tsx`: `Cookies.set("access_token", token, { secure: true, sameSite: "Lax", expires: 7 })`. |
| H-04 | **Media** | Storage | No existe job automático de limpieza de archivos huérfanos en Supabase. El `StorageGovernanceService` tiene reconciliación manual vía `POST /organizations/me/storage/reconcile`. | `storage-governance.service.ts`; `TECH_DEBT.md` ítem #4 | Crecimiento no controlado de storage. Sin impacto en tenants pero aumenta costo operativo con el tiempo. | Job periódico o tarea manual mensual de reconciliación por org. |
| H-05 | **Media** | Backups | No puede verificarse el plan de Supabase activo ni si los backups automáticos están habilitados desde el repositorio. | Requiere acceso al dashboard de Supabase | Si la DB sufre corrupción o borrado accidental, recuperación no está garantizada. | Verificar en dashboard.supabase.com → Settings → Backups. |
| H-06 | **Baja** | Deploy | URL de producción de Railway y Vercel no está documentada ni verificable desde el repo. El commit en producción no puede confirmarse sin acceso a dashboards. | No hay `vercel.json`, `railway.json` ni CI/CD pipeline en el repo. | Imposibilidad de verificar automáticamente si los deploys están en el commit esperado. | Agregar URL de producción a `ARCHITECTURE.md` o a un runbook de operaciones (sin secretos). |
| H-07 | **Baja** | Email UX | Las páginas `/forgot-password` y `/reset-password` están presentes en el frontend. Si `RESEND_API_KEY` no está configurada en Railway, los usuarios ven un 500 cuando intentan recuperar contraseña. | `frontend/src/app/(auth)/forgot-password/`, `reset-password/` | Riesgo UX: el usuario percibe el sistema como roto. | Ver H-01. Mitigación inmediata: confirmar que `RESEND_API_KEY` y `FRONTEND_URL` están seteadas en Railway. |
| H-08 | **Info** | Auth | JWT TTL 12h. Tokens generados antes de la migración `add_user_sessions` (sin campo `sid`) no son revocables server-side. Tokens nuevos con `sid` sí se revocan via `UserSession`. | `auth.module.ts`; `jwt.strategy.ts` | Tokens legacy expiran solos en máximo 12h. Sin riesgo activo con 1 cliente y operación reciente. | Monitorear. Aceptable en el estado actual. |

---

## 3. Logs de Producción

| Fuente | Error/Warning | Frecuencia estimada | Riesgo | Acción |
|---|---|---|---|---|
| Railway (stdout) | No accesible sin acceso al dashboard | — | — | Verificar manualmente en Railway → Logs. Buscar: `[ERROR]`, `500`, `Prisma`, `PrismaClientKnownRequestError`, `CORS`, `Missing required production environment`. |
| Vercel | No accesible sin acceso al dashboard | — | — | Verificar en Vercel → Deployments → Functions logs. Buscar errores de build y errores de runtime SSR. |
| Winston (configuración verificada) | JSON en producción, level `info`. Requests >300ms logueados automáticamente. Errores 4xx **no logueados** por diseño (comentado en `AllExceptionsFilter`). | — | Bajo | Considerar loguear 401/403 con contexto mínimo para detectar accesos no autorizados. |
| Throttler | Intentos de login sobre límite (5/min) → 429. No logueados explícitamente. | Depende de actividad | Bajo | Normal. Monitorear picos vía Railway logs si es necesario. |

**Nota:** Los logs reales de producción requieren acceso directo a Railway. El análisis documenta la arquitectura de logging para orientar la revisión manual.

---

## 4. Performance Básica

| Endpoint | Muestras | Tiempo aproximado | Estado | Observación |
|---|---|---|---|---|
| `GET /` | No medido | — | Requiere URL producción | Endpoint existe, retorna string simple. No hay `/health` dedicado. |
| `GET /auth/me` | No medido | — | Requiere URL producción | 2 queries por request: `findUnique User` + `findFirst UserSession`. |
| `GET /dashboard` | No medido | — | Requiere URL producción | ~13 queries en `Promise.all`. Con pocos datos, esperado <300ms. |
| `GET /assets` | No medido | — | Requiere URL producción | Paginado. Índices en `organization_id`, `created_at` presentes. |
| `GET /services` | No medido | — | Requiere URL producción | Ídem. Índices presentes. |

**No se pudo medir:** La URL de producción del backend no está accesible desde este entorno.

**Proxy de performance disponible:** El middleware de request timing (`main.ts:59–68`) logea automáticamente requests >300ms. Revisar en Railway Logs filtrando por `RequestTiming` para detectar endpoints lentos sin carga adicional.

---

## 5. Base de Datos y Storage

| Validación | Resultado | Estado | Observación |
|---|---|---|---|
| Migraciones pendientes | No verificable sin acceso a DB | Requiere verificación | `SELECT * FROM "_prisma_migrations" WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;` en Supabase SQL Editor. |
| Constraint `Asset_owner_same_organization_fkey` | Definida en migración `20260517000100` con `IF NOT EXISTS` | ✅ Definida en código | Verificar: `SELECT conname FROM pg_constraint WHERE conname = 'Asset_owner_same_organization_fkey';` |
| Constraint `Service_asset_same_organization_fkey` | Definida en migración `20260517000100` | ✅ Definida en código | Ídem. |
| Constraint `User_role_owner_consistency_chk` | Definida en migración `20260517000100` | ✅ Definida en código | Ídem. |
| Constraint `StoredFile_entity_type_chk` | Definida en migración `20260517000100` | ✅ Definida en código | Ídem. |
| Migración `init_local` aplicada en prod | No verificable sin acceso | **Requiere verificación urgente** | Ver H-02. Query: `SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 10;` |
| Conteos básicos (orgs, usuarios, assets, services) | No verificable sin acceso a DB | Requiere verificación | Consultar en Supabase SQL Editor con `SELECT COUNT(*) FROM "Organization";` etc. No destructivo. |
| StoredFiles huérfanos | No verificable sin acceso a DB | Requiere verificación | `SELECT COUNT(*) FROM "StoredFile" WHERE entity_id IS NULL AND status = 'READY';` — no destructivo. |
| Services sin asset | Imposible por constraint `Service_asset_same_organization_fkey` | ✅ Protegido por FK | La constraint previene servicios huérfanos. |
| Assets sin owner | Imposible por `owner_id NOT NULL` desde migración `20260517000100` | ✅ Protegido por NOT NULL | Campo forzado a NOT NULL. |
| Storage usando Supabase en producción | Enforced en `main.ts` + startup check fatal | ✅ Verificado en código | `STORAGE_TYPE !== 'supabase'` lanza error fatal al iniciar. No puede arrancarse en modo local en producción. |
| `/uploads` no sirve archivos en producción | `ServeStaticModule` condicional a `NODE_ENV !== 'production'` | ✅ Verificado en código | `app.module.ts:36–41`. Correcto. SEC-07 cerrado. |
| Errores recientes de signed URLs | No verificable sin logs de Railway | Requiere verificación | Buscar en logs: `SupabaseStorageService` + `error`. |
| StoredFiles sin uso aparente | No verificable sin acceso a DB | Requiere revisión periódica | Reconciliación disponible: `POST /organizations/me/storage/reconcile` (solo ADMIN). |

---

## 6. Configuración y Deploy

| Validación | Resultado | Estado | Observación |
|---|---|---|---|
| Commit en Railway | No verificable sin acceso al dashboard | Requiere verificación | Confirmar que el deploy activo corresponde al commit `c7c153a` o posterior. |
| Commit en Vercel | No verificable sin acceso al dashboard | Requiere verificación | Ídem. |
| Rama productiva es `main` | El repo tiene una sola rama activa: `main` | ✅ Sin ambigüedad | No hay ramas de feature activas divergentes. |
| Deploys fallidos recientes | No verificable sin acceso a dashboards | Requiere verificación | Revisar Railway → Deployments y Vercel → Deployments por status `FAILED`. |
| Variables requeridas en startup | 10 vars validadas: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `STORAGE_TYPE`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLIC_BUCKET`, `SUPABASE_PRIVATE_BUCKET`, `SIGNED_URL_TTL_SECONDS`, `CORS_ORIGIN` | ✅ Verificado en código | `RESEND_API_KEY` y `FRONTEND_URL` **no** están en la lista — ver H-01. |
| CORS configurado correctamente | `CORS_ORIGIN` requerida, sin wildcard, validación estricta de origen | ✅ Verificado en código | `main.ts:75–94`. |
| Swagger deshabilitado en producción | Condicionado a `!isProduction` | ✅ Verificado en código | `main.ts:103–112`. SEC-06 cerrado. |
| Throttling en endpoints críticos | Login 5/min, forgot-password 3/min, register 10/min, global 60/min | ✅ Verificado en código | `ThrottlerGuard` como `APP_GUARD` global. `trust proxy: 1` para IP real via Railway. |
| Helmet con CORP `same-origin` | `crossOriginResourcePolicy: 'same-origin'` en producción | ✅ Verificado en código | `main.ts:59–63`. |
| Frontend llama al backend de producción | Via `NEXT_PUBLIC_API_URL` — no hardcoded | ✅ Arquitectura correcta | `frontend/src/lib/api.ts:3`. Requiere que la var esté seteada en Vercel. |
| Rollback de deploy | Railway y Vercel soportan rollback nativo a deploy anterior | ✅ Capacidad existe | Sin runbook documentado. Requiere acceso manual a dashboard. |
| Backups de Supabase | Depende del plan activo | Requiere verificación | Free tier: 7 días. Pro tier: PITR disponible. Confirmar en Supabase → Settings → Backups. |

---

## 7. Riesgos Antes de Sumar Más Clientes

### Bloqueantes

| # | Riesgo | Por qué bloquea | Acción |
|---|---|---|---|
| B-01 | `RESEND_API_KEY` y `FRONTEND_URL` ausentes de validación de startup + sin try/catch en email sends | Con más clientes habrá más intentos de forgot-password e invitaciones. Un 500 en ese flujo daña la confianza del nuevo cliente antes de empezar. | Verificar que ambas vars están en Railway. Agregar a `requireProductionEnv`. Envolver sends de email en try/catch. |
| B-02 | Estado de la migración `init_local` en producción sin verificar | Si hay divergencia, el próximo `prisma migrate deploy` puede fallar en caliente. | Verificar en Supabase SQL Editor antes del próximo deploy. |

### Importantes (no bloquean hoy, sí antes de escalar)

| # | Riesgo | Impacto | Acción |
|---|---|---|---|
| I-01 | Cookie `access_token` sin `secure` en `AuthContext.tsx` | Inconsistencia con `auth.ts`. En HTTPS el riesgo es bajo, pero debe unificarse. | `Cookies.set("access_token", token, { secure: true, sameSite: "Lax", expires: 7 })` en `AuthContext.tsx:75`. |
| I-02 | Sin limpieza automática de archivos huérfanos en Supabase | Con más tenants, los blobs huérfanos acumulan costo y cuota. | Job periódico o tarea operativa mensual con el endpoint de reconciliación. |
| I-03 | Backups de Supabase no verificados | Sin PITR, pérdida de datos de clientes ante corrupción accidental. | Verificar plan Supabase activo. |
| I-04 | No hay endpoint `/health` ni monitoreo externo activo conocido | Un crash silencioso puede no detectarse hasta que un cliente lo reporte. | Agregar `GET /health` y configurar uptime monitor externo (UptimeRobot, BetterUptime). |
| I-05 | Errores 4xx no logueados | 401/403 repetidos podrían indicar intentos no autorizados o bugs de auth, sin trazabilidad. | Loguear 401/403 con URL y timestamp en `AllExceptionsFilter`. |

### Deuda Aceptada

| # | Deuda | Documentada en |
|---|---|---|
| D-01 | JWT en `localStorage` + cookie JS-accesible. Sesiones server-side como mitigación parcial. | `TECH_DEBT.md` #1 |
| D-02 | `resolveFileUrlForOrg` sin contexto de tenant (defensa en profundidad, sin vulnerabilidad activa). | `TECH_DEBT.md` #3 |
| D-03 | Specs con mocks Prisma desactualizados (no bloquean producción). | `TECH_DEBT.md` #2 |
| D-04 | Respuestas inconsistentes de API (DELETE físico vs soft-delete, etc.). | `TECH_DEBT.md` #5 |
| D-05 | Emails transaccionales implementados en backend pero dependientes de `RESEND_API_KEY`. Sin promesa rota si el cliente actual no los usa activamente. | H-01, H-07 |

---

## 8. Conclusión

**El sistema puede operar con 1 cliente** en su estado actual, asumiendo que los flujos de email no son funcionalidad prometida activamente.

**Antes de sumar 2–4 clientes adicionales**, resolver en este orden:

1. **[B-01]** Verificar en Railway que `RESEND_API_KEY` y `FRONTEND_URL` están configuradas. Si no, los flujos de forgot-password e invitaciones rompen con 500.
2. **[B-02]** Verificar en Supabase SQL Editor que la migración `20260607043818_init_local` aparece en `_prisma_migrations` con `finished_at IS NOT NULL`.
3. **[I-03]** Verificar en Supabase Dashboard que el plan tiene backups automáticos activos.
4. **[I-04]** Agregar `GET /health` y configurar un uptime monitor externo.
5. **[I-01]** Unificar cookie con `secure: true, sameSite: 'Lax'` en `AuthContext.tsx:75`.

Los ítems de deuda aceptada (JWT en localStorage, specs desactualizados, storage sin contexto de tenant) son conocidos, documentados en `TECH_DEBT.md` y no representan riesgo activo con el volumen actual de clientes.

---

## Queries de verificación manual (no destructivas)

Ejecutar en Supabase SQL Editor (solo lectura):

```sql
-- Estado de migraciones (verificar init_local)
SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
ORDER BY started_at DESC
LIMIT 15;

-- Constraints críticas de integridad
SELECT conname, contype, conrelid::regclass AS tabla
FROM pg_constraint
WHERE conname IN (
  'Asset_owner_same_organization_fkey',
  'Service_asset_same_organization_fkey',
  'User_role_owner_consistency_chk',
  'StoredFile_entity_type_chk'
);

-- Conteos básicos
SELECT
  (SELECT COUNT(*) FROM "Organization" WHERE is_active = true) AS orgs_activas,
  (SELECT COUNT(*) FROM "User" WHERE is_active = true)         AS usuarios_activos,
  (SELECT COUNT(*) FROM "Asset" WHERE is_active = true)        AS assets_activos,
  (SELECT COUNT(*) FROM "Service")                             AS services_total,
  (SELECT COUNT(*) FROM "StoredFile" WHERE status = 'READY')  AS stored_files_ready;

-- StoredFiles potencialmente huérfanos (entity_id NULL)
SELECT COUNT(*) AS huerfanos_potenciales
FROM "StoredFile"
WHERE entity_id IS NULL
  AND status = 'READY';
```

---

**Limitaciones de esta auditoría:** El análisis fue 100% estático (código + git). No fue posible medir performance real, revisar logs de Railway/Vercel, ni ejecutar queries en la DB de producción. Los ítems marcados como "requiere verificación manual" deben completarse con acceso directo a los dashboards de Railway, Vercel y Supabase.
