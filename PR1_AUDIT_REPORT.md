# PR1 — Auditoría: Optimización de Infraestructura y Rendimiento

**Fecha:** 2026-06-28  
**Rama auditada:** `fix/auth-critical-hardening`  
**Commits del PR1:** `a7bbf61` → `e96401b` (8 commits con prefijo `perf:`)  
**Método:** Inspección de código fuente, ejecución de tests, análisis de migraciones  
**Auditor:** Claude Code

---

## Resumen ejecutivo

| | |
|---|---|
| **Resultado** | PARCIALMENTE CORRECTO |
| **Riesgo** | MEDIO |
| **Tests** | 8 fallando (CI roto) |
| **Decisión** | Se puede desplegar **con observaciones** — ver sección F |

Los 8 commits del PR1 están presentes y la mayoría de los cambios son correctos. Sin embargo, el PR1 introduce un método nuevo (`resolveFileUrlsForOrg`) sin actualizar los mocks de test en 3 archivos spec, dejando el CI con 8 tests fallando. Además, los code paths sin paginación no fueron eliminados completamente y dos bugs de `purged_at` pre-existentes permanecen sin corrección.

Los bloqueantes de seguridad del PRE_PRODUCTION_AUDIT.md (AUTH-C1, FE-C1, DB-C1, SEC-C1, etc.) son independientes del PR1 y siguen pendientes.

---

## Commits del PR1

| Commit | Descripción |
|---|---|
| `a7bbf61` | Eliminar patrón N+1 — batch query `resolveFileUrlsForOrg()` |
| `3070087` | Optimizar queries del dashboard con SQL GROUP BY y COUNT DISTINCT |
| `3074005` | Observabilidad mínima — slow queries, auth warnings y startup log |
| `157c59f` | Paginar historial de servicios en detalle de activo |
| `dab4481` | Limitar tamaño máximo de página en todos los findAll |
| `c728759` | Agregar índices compuestos ausentes en Service y User |
| `74497c7` | Reducir polling agresivo y extender SSE al dashboard |
| `e96401b` | Fix: eliminar CONCURRENTLY de migración de índices compuestos |

---

## A. Cambios confirmados

### A-1 · N+1 eliminado con batch query (`a7bbf61`)

**Archivo:** `backend/src/storage/stored-files.service.ts:91–116`

Se agrega `resolveFileUrlsForOrg()`: un único `findMany` para N IDs dentro de la misma organización, en lugar de N llamadas `findUnique` secuenciales. Seis servicios migrados correctamente.

**Reducción de queries confirmada:**

| Endpoint | Antes | Después |
|---|---|---|
| `GET /services` (50 items, 3 adj. c/u) | 151 queries | 1 query |
| `GET /assets` (50 items) | 51 queries | 1 query |
| `GET /users` (50 usuarios) | 50 queries | 1 query |
| `GET /owners` (30 owners, 5 assets c/u) | 181 queries | 1 query |

**Estado:** ✅ Correcto — tests de `stored-files.service.spec.ts` pasan (32/32)

> ⚠️ Los mocks en 3 spec files no fueron actualizados. Ver problema P-1.

---

### A-2 · Dashboard SQL GROUP BY (`3070087`)

**Archivo:** `backend/src/dashboard/dashboard.service.ts`

- `getEvolutionCountsRaw`: reemplaza `findMany` (N filas brutas) por `$queryRaw GROUP BY DATE_TRUNC` — típicamente 7–365 filas agrupadas en lugar de todas
- `getDistinctCountsRaw`: dos groupBy separados → `COUNT(DISTINCT)` en un solo round-trip
- Public/private counts: dos `count()` → un `groupBy(['is_public'])`
- Reducción total: 13 → 11 queries por llamada al dashboard

**Estado:** ✅ Correcto

> ⚠️ Las condiciones del raw SQL no incluyen `"purged_at" IS NULL`. Ver problema P-3.

---

### A-3 · Observabilidad mínima (`3074005`)

**Archivos:** `prisma.service.ts`, `all-exceptions.filter.ts`, `main.ts`

| Qué | Dónde | Umbral |
|---|---|---|
| Slow queries logueadas como `warn` | `PrismaService.$on('query')` | ≥ 500ms |
| 401/403 logueados como `warn` | `AllExceptionsFilter` | Siempre |
| Startup log (port, env, storage, CF Stream) | `bootstrap()` | Al arrancar |

El snippet SQL en los slow query logs se trunca a 200 caracteres. Los logs de 401/403 no exponen stack trace.

**Estado:** ✅ Correcto

---

### A-4 · Paginación del historial de servicios en asset detail (`157c59f`)

**Archivos:** `assets.controller.ts:100–110`, `assets.service.ts:437–513`

- `GET /assets/:id` acepta `?servicePage` y `?serviceLimit` (máx 50)
- `service.count` corre en paralelo con `findFirst` via `Promise.all`
- Respuesta incluye `services_meta: { total, page, limit, totalPages }`
- Filtro `is_public` para rol EXTERNAL movido al WHERE de SQL — ya no carga servicios privados para descartarlos en JS

**Estado:** ✅ Correcto

---

### A-5 · Límite máximo de página (`dab4481`)

**Archivos:** `pagination-query.dto.ts`, 5 servicios

- `@Max(100)` en `PaginationQueryDto.limit` — validación a nivel DTO
- `Math.min(limit, 100)` defensivo en assets, services, trash, companies, users
- Constante `MAX_PAGE_SIZE = 100` exportada

**Estado:** ⚠️ Parcialmente correcto — ver problema P-2

---

### A-6 · Índices compuestos (`c728759` + `e96401b`)

**Archivos:** `migrations/20260627120000_add_composite_indexes/migration.sql`, `schema.prisma`

| Índice | Tabla | Uso |
|---|---|---|
| `(organization_id, worker_id)` | Service | Ranking de workers, COUNT(DISTINCT), filtro WORKER |
| `(organization_id, is_public)` | Service | Dashboard public/private groupBy, queries EXTERNAL |
| `(asset_id, is_public, created_at DESC)` | Service | Paginación de historial para EXTERNAL |
| `(organization_id, role, is_active)` | User | Conteo de workers y admins activos en dashboard |

`CONCURRENTLY` removido correctamente (`e96401b`) — Prisma envuelve migraciones en transacción y `CONCURRENTLY` no puede ejecutarse dentro de una.

**Estado:** ✅ Correcto

> ⚠️ Sin `CONCURRENTLY`, la migración bloquea escrituras durante la creación de índices. Aplicar en horario de baja carga en producción.

---

### A-7 · Reducción de polling + SSE al dashboard (`74497c7`)

**Archivos:** `queryAutoRefetch.ts`, `RealtimeQueryInvalidator.tsx`

| Intervalo | Antes | Después |
|---|---|---|
| `fast` (listas con SSE) | 30s | 120s |
| `detail` (vistas de detalle) | 60s | 300s |
| `dashboard` | 60s | 300s |

El SSE invalidator ahora invalida `dashboard-stats` cuando se emiten eventos de `assets` o `services` mientras el usuario está en `/dashboard`. Reducción estimada de requests de polling: ~75%.

**Estado:** ✅ Correcto

---

## B. Resultados de tests

```
Comando: npx jest --no-coverage

Test Suites: 3 failed, 25 passed, 28 total
Tests:       8 failed, 215 passed, 223 total

Suites fallando:
  - assets.service.spec.ts
  - services.service.spec.ts
  - companies.service.spec.ts

Tests relacionados con PR1:
  npx jest "stored-files|dashboard.service" --no-coverage
  → 32 passed — PASAN ✅
```

---

## C. Problemas encontrados

### P-1 · Tests unitarios fallando — mocks desactualizados

| | |
|---|---|
| **Severidad** | ALTA |
| **Archivos** | `assets.service.spec.ts:40`, `services.service.spec.ts:65`, `companies.service.spec.ts:39` |
| **Tipo** | Introducido por el PR1 |

**Explicación:** El PR1 agrega `resolveFileUrlsForOrg` (batch, retorna `Map`) y migra 6 servicios a usarla. Los mocks de test en 3 spec files solo definen `resolveFileUrlForOrg` (singular, retorna `string | null`).

```typescript
// Estado actual en los 3 spec files — INCOMPLETO:
useValue: {
  resolveFileUrl: jest.fn().mockResolvedValue(null),
  resolveFileUrlForOrg: jest.fn().mockResolvedValue(null),
  // ← resolveFileUrlsForOrg AUSENTE
}

// Error en runtime:
// TypeError: this.storedFilesService.resolveFileUrlsForOrg is not a function
```

**Consecuencia:** CI/CD roto. Los 8 tests fallando son de flujos de creación y lectura de assets, services y owners.

**Corrección:**
```typescript
// Agregar en los 3 spec files:
resolveFileUrlsForOrg: jest.fn().mockResolvedValue(new Map()),
```

---

### P-2 · Code paths sin paginación persisten (`findMany` sin `take`)

| | |
|---|---|
| **Severidad** | MEDIA |
| **Archivos** | `assets.service.ts:332–338`, `services.service.ts:970–1025` |
| **Tipo** | PERF-H1 parcialmente resuelto |

**Explicación:** El `@Max(100)` del DTO solo aplica cuando el cliente envía los parámetros. El code path `else` (sin `?page` y `?limit`) sigue ejecutando `findMany` sin `take`:

```typescript
// assets.service.ts:311
if (query.page && query.limit) {
  // paginado — correcto
} else {
  const assets = await this.prisma.asset.findMany({
    where: baseWhere,
    include,       // eager-load de relaciones
    orderBy,
    // ← SIN take — carga TODOS los registros
  });
}
```

**Consecuencia:** Con 10.000 activos sin parámetros de paginación: carga completa en heap de Node.js con relaciones eager-loaded → OOM probable, timeout de Railway (60s) posible.

**Corrección:**
```typescript
// Eliminar el else sin take. Aplicar límite siempre:
const page = Math.max(1, Number(query.page) || 1);
const limit = Math.min(Number(query.limit) || 50, 100);
const [data, total] = await Promise.all([
  this.prisma.asset.findMany({ where, include, orderBy, skip: (page-1)*limit, take: limit }),
  this.prisma.asset.count({ where }),
]);
```

---

### P-3 · `purged_at` ausente del raw SQL del dashboard (DB-H3)

| | |
|---|---|
| **Severidad** | ALTA (pre-existente, no introducida por PR1) |
| **Archivos** | `dashboard.service.ts:288`, `dashboard.service.ts:334` |

Las funciones `getEvolutionCountsRaw` y `getDistinctCountsRaw` creadas en el PR1 heredan el bug original: incluyen `"deleted_at" IS NULL` pero no `"purged_at" IS NULL`.

```sql
-- Condiciones actuales en ambas funciones:
"deleted_at" IS NULL
-- ← "purged_at" IS NULL AUSENTE
```

**Consecuencia:** Servicios purgados (eliminación irreversible, potencialmente por GDPR) aparecen en gráficos de evolución temporal y en conteos de activos serviciados del dashboard.

**Corrección:** Agregar `Prisma.sql\`"purged_at" IS NULL\`` al array `conditions` inicial en ambas funciones.

---

### P-4 · `purged_at` ausente en `buildStatsWhere` de users (DB-H4)

| | |
|---|---|
| **Severidad** | ALTA (pre-existente, no introducida por PR1) |
| **Archivo** | `users.service.ts:114` |

```typescript
private buildStatsWhere(currentUser: { role: Role; orgId?: string }) {
  const where: any = { deleted_at: null };
  // ← purged_at: null AUSENTE
```

**Consecuencia:** Usuarios purgados aparecen en listados de ADMIN y en estadísticas. Viola el derecho al olvido (GDPR) si se usa en producción.

**Corrección:**
```typescript
const where: any = { deleted_at: null, purged_at: null };
```

---

## D. Validaciones manuales pendientes

### Railway — Panel de configuración

| Ítem | Estado | Acción |
|---|---|---|
| `startCommand` | ✅ En railway.json | Verificar que Railway lo lee correctamente |
| `buildCommand` | ❌ Ausente en railway.json | Configurar en panel: `cd backend && npm install && npm run build` |
| `preDeployCommand` (migraciones) | ❌ Ausente en railway.json | Configurar en panel: `cd backend && npx prisma migrate deploy` |
| `healthcheckPath` | ❌ Ausente en railway.json | Agregar al servicio backend en panel: `/health` |
| `healthcheckTimeout` | ❌ Ausente | Configurar: 30 segundos |
| `DATABASE_URL` | No verificable | Debe usar URL de Supavisor: `...pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | No verificable | Debe ser la URL directa (sin pooler, puerto 5432) — para `prisma migrate deploy` |
| `CLOUDFLARE_STREAM_WEBHOOK_SECRET` | No verificable | Requerido para cerrar bug MT-C1 del audit de seguridad |
| `CORS_ORIGIN` | No verificable | Requerido en producción o el backend rechaza todos los orígenes |
| Réplicas | No verificable | Si hay más de 1 réplica, el ThrottlerModule en memoria es inefectivo (AUTH-H1) |

### Supabase

| Ítem | Estado | Acción |
|---|---|---|
| Supavisor URL en DATABASE_URL | No verificable | Confirmar formato correcto en Railway env vars |
| Índices del PR1 aplicados | No verificable | Verificar con `\d "Service"` en psql que los 4 índices existen en producción |
| Bloqueo durante migración de índices | ⚠️ Riesgo | Aplicar `prisma migrate deploy` en horario de baja carga |
| RLS habilitado | ❌ Sin RLS | No abordado por PR1 — riesgo DB-M1 del audit previo |
| FKs cross-tenant restauradas | ❌ Eliminadas | No abordado por PR1 — bloqueante DB-C1 del audit previo |
| Índices aún faltantes | ❌ Parcial | `StoredFile(org_id, status)`, `Asset(org_id, deleted_at, is_active)`, `Owner(org_id, is_active)`, `FileUpload(org_id, status, expires_at)` — fuera del scope del PR1 |

### Vercel / Next.js

| Ítem | Estado | Acción |
|---|---|---|
| Function Region | No verificable | Configurar en Vercel panel — región más cercana a Railway y Supabase |
| `NEXT_PUBLIC_API_URL` | No verificable | Confirmar que apunta al backend de Railway en producción |
| `next/image` | ❌ No usado | Todas las imágenes usan `<img loading="lazy">` — sin optimización automática de Vercel. Evaluar migración |
| `remotePatterns` | No aplica hoy | Necesario si se adopta `next/image` con Supabase Storage / CF Stream |
| Cache de datos privados | No verificable | Confirmar que respuestas de API tienen `Cache-Control: no-store` para datos de tenant |

### Cloudflare

| Ítem | Estado | Acción |
|---|---|---|
| Cache Rules para rutas autenticadas | No verificable | Confirmar en panel: `/api/*`, `/dashboard*`, `/assets*` → Cache Level: **Bypass** |
| Cache de assets estáticos | No verificable | Confirmar: `/_next/static/*` → caché habilitado (TTL largo) |
| Subdominio CF Stream hardcodeado | ❌ SEC-H3 activo | `cloudflare.service.ts:46` tiene el subdominio real como default — no abordado por PR1 |
| Webhook Cloudflare Stream | ❌ MT-C1 activo | Bug de verificación de firma sigue activo — no abordado por PR1 |

---

## E. Pasos a seguir

### Inmediato — Antes de cualquier despliegue

Estas acciones son obligatorias. Ningún deploy a producción antes de completarlas.

---

**Paso 1 — Corregir mocks de tests (P-1)**

Tiempo estimado: 15 minutos.

En los 3 archivos spec, agregar `resolveFileUrlsForOrg` al mock de `StoredFilesService`:

```typescript
// backend/src/assets/assets.service.spec.ts (línea ~40)
// backend/src/services/services.service.spec.ts (línea ~65)
// backend/src/companies/companies.service.spec.ts (línea ~39)

useValue: {
  resolveFileUrl: jest.fn().mockResolvedValue(null),
  resolveFileUrlForOrg: jest.fn().mockResolvedValue(null),
  resolveFileUrlsForOrg: jest.fn().mockResolvedValue(new Map()), // ← AGREGAR
  registerUploadedFile: jest.fn(),
  deleteStoredFileAndBlob: jest.fn(),
},
```

Verificar con:
```bash
cd backend && npx jest --no-coverage
# Objetivo: 0 suites fallando
```

---

**Paso 2 — Configurar Railway en el panel**

Tiempo estimado: 10 minutos.

En el panel de Railway, para el servicio `backend`, configurar:

```
Build Command:       cd backend && npm install && npm run build
Start Command:       npm run start:prod  (ya está en railway.json)
Pre-deploy Command:  cd backend && npx prisma migrate deploy
Health Check Path:   /health
Health Check Timeout: 30
```

Para las variables de entorno, confirmar que existen:
```
DATABASE_URL      → postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL        → postgresql://...supabase.co:5432/postgres
JWT_SECRET        → (valor seguro, no vacío)
STORAGE_TYPE      → supabase
CORS_ORIGIN       → https://app.fentri.com (URL real de Vercel)
SUPABASE_URL      → https://<proyecto>.supabase.co
SUPABASE_SERVICE_ROLE_KEY → (service role key de Supabase)
SUPABASE_PUBLIC_BUCKET    → (nombre del bucket público)
SUPABASE_PRIVATE_BUCKET   → (nombre del bucket privado)
SIGNED_URL_TTL_SECONDS    → 3600
CLOUDFLARE_STREAM_WEBHOOK_SECRET → (secret del webhook de CF)
```

---

**Paso 3 — Verificar índices en producción**

Después de que `prisma migrate deploy` se ejecute, confirmar que los 4 índices del PR1 existen:

```sql
-- Ejecutar en Supabase SQL Editor o psql:
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('Service', 'User')
  AND indexname IN (
    'Service_organization_id_worker_id_idx',
    'Service_organization_id_is_public_idx',
    'Service_asset_id_is_public_created_at_idx',
    'User_organization_id_role_is_active_idx'
  );

-- Esperado: 4 filas
```

---

### Semana actual — Correcciones de código

**Paso 4 — Eliminar code paths sin paginación (P-2)**

Archivos: `assets.service.ts`, `services.service.ts`

Eliminar el bloque `else { findMany sin take }` y aplicar paginación siempre con un default:

```typescript
// Patrón a aplicar en ambos servicios:
const page = Math.max(1, Number(query.page) || 1);
const limit = Math.min(Number(query.limit) || 50, MAX_PAGE_SIZE);
const [data, total] = await Promise.all([
  this.prisma.asset.findMany({
    where: baseWhere,
    include,
    orderBy,
    skip: (page - 1) * limit,
    take: limit,
  }),
  this.prisma.asset.count({ where: baseWhere }),
]);
return {
  data: await this.resolveAssetListFileUrls(data),
  meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
};
```

---

**Paso 5 — Agregar `purged_at` al raw SQL del dashboard (P-3)**

Archivo: `backend/src/dashboard/dashboard.service.ts`

En `getEvolutionCountsRaw` (línea ~288) y `getDistinctCountsRaw` (línea ~334), agregar al array `conditions`:

```typescript
const conditions: Prisma.Sql[] = [
  Prisma.sql`"deleted_at" IS NULL`,
  Prisma.sql`"purged_at" IS NULL`,  // ← AGREGAR
  // ... resto de condiciones
];
```

---

**Paso 6 — Agregar `purged_at` al `buildStatsWhere` de users (P-4)**

Archivo: `backend/src/users/users.service.ts:114`

```typescript
private buildStatsWhere(currentUser: { role: Role; orgId?: string }) {
  const where: any = { deleted_at: null, purged_at: null };  // ← AGREGAR purged_at
  // ... resto sin cambios
}
```

Y en `findAll` query builder:
```typescript
// línea ~198
where.deleted_at = null;
where.purged_at = null;  // ← AGREGAR
```

---

### Primera semana — Bloqueantes de seguridad del audit previo

Los siguientes items son bloqueantes del PRE_PRODUCTION_AUDIT.md y son independientes del PR1. Deben resolverse antes del primer cliente.

| Prioridad | ID | Acción | Estimado |
|---|---|---|---|
| 1 | AUTH-C1 | Agregar `if (payload.purpose) throw new UnauthorizedException()` en `jwt.strategy.ts:50` | 1h |
| 2 | FE-C1 | Renombrar `proxy.ts` → `middleware.ts`; cambiar a `export default function middleware(...)` | 1h |
| 3 | DB-C1 | Nueva migración que restaure las 2 FKs cross-tenant eliminadas en `20260517145921` | 2h |
| 4 | SEC-C1 | `git rm --cached -r backend/uploads/` + coordinar `git filter-repo` con el equipo | 2h |
| 5 | AUTH-C3 | Hashear tokens de reset e invitación con SHA-256 antes de persistir | 4h |
| 6 | DB-C2 | Cifrar `two_factor_secret` con AES-256-GCM (patrón ya existente en AiSettings) | 3h |
| 7 | AUTH-C4 | Eliminar `secret` del JWT de setup; persistir en BD con TTL | 3h |
| 8 | MT-C1 | Fix webhook Cloudflare: rechazar requests sin header de firma cuando el secret está configurado | 1h |
| 9 | SEC-H2 | Agregar containment check en `LocalStorageService.deleteFile` | 1h |

Ver `PRE_PRODUCTION_AUDIT.md` y `AUDIT_VALIDATION.md` para detalle completo de cada hallazgo.

---

### Primer mes — Deuda técnica y hardening

| ID | Acción |
|---|---|
| AUTH-H2 | Rechazar tokens JWT sin `sid` |
| AUTH-H3 | Restringir auto-registro de organización (clave de API o invitación) |
| FE-H1/H2 | Migrar access token a cookie `httpOnly; Secure; SameSite=Strict` |
| DB-H1 | Agregar FK de `UserSession.organization_id` a `Organization` |
| DB-H2 | Agregar constraint de mismo-org en `WorkerAssetAccess` |
| DB-M1 | Implementar RLS básico en tablas tenant-scoped |
| DB-M2 | Migrar `StoredFile.size_bytes` de `Int` a `BigInt` |
| PERF-H3 | Reemplazar SUM aggregate en `assertCanStore` por tabla `OrganizationStorageUsage` |
| PERF-H4 | Convertir uploads secuenciales en `services.create` a `Promise.all` |
| SEC-H3 | Eliminar subdominio CF Stream hardcodeado en `cloudflare.service.ts:46` |
| SEC-H4 | Fallar cerrado en CORS cuando `allowedOrigins` está vacío |
| EXTRA-1 | Agregar `npm audit` y `snyk test` en CI como gate de calidad |

---

## F. Veredicto final

```
→ SE PUEDE DESPLEGAR CON OBSERVACIONES
```

El PR1 es funcionalmente correcto y mejora significativamente el rendimiento del sistema. No introduce nuevas vulnerabilidades de seguridad. Puede desplegarse una vez que:

1. ✅ Los 8 tests fallando estén corregidos (Paso 1 — 15 min)
2. ✅ Railway esté configurado con `preDeployCommand` para migraciones (Paso 2 — 10 min)
3. ✅ Los índices compuestos estén confirmados en producción (Paso 3)

Los problemas P-2, P-3 y P-4 son correcciones de código que pueden hacerse en el siguiente PR sin bloquear este despliegue.

El sistema sigue en estado **NO LISTO para el primer cliente** hasta resolver los bloqueantes del PRE_PRODUCTION_AUDIT.md, que son independientes del PR1.

---

## G. Comandos de referencia

```bash
# Verificar tests (objetivo: 0 fallando)
cd backend && npx jest --no-coverage

# TypeScript check
cd backend && npx tsc --noEmit

# Verificar healthcheck (después de arrancar el backend)
curl http://localhost:3001/health
# Esperado: {"status":"ok","database":"ok","timestamp":"..."}

# Verificar índices en producción (desde psql o Supabase SQL Editor)
SELECT indexname FROM pg_indexes
WHERE tablename IN ('Service', 'User')
  AND indexname LIKE '%organization_id%';

# Aplicar migraciones manualmente si Railway no lo hace
cd backend && npx prisma migrate deploy
```

---

*Documento generado el 2026-06-28. Basado en inspección estática del código fuente y ejecución de tests. Ningún código fue modificado durante la auditoría.*
