# Performance Audit — Recall

## Fecha

2026-06-08

---

## Resumen ejecutivo

El sistema está bien estructurado y tiene un buen nivel de hardening para uploads (Sharp, WebP, límites de tamaño). P01/P02/P03 ya están implementados: cache in-memory para signed URLs, `assertCanStore` con aggregate en DB y `resolveFileUrlForOrg` propagado. P07/QW4 también está implementado: los intervalos de refetch frontend ya no son de 5s. No hay bloqueantes absolutos para demo o bajo volumen. Antes de sumar varios clientes activos, los principales riesgos restantes son listados sin paginación, queries duplicadas/innecesarias en frontend y detalle de activo sin paginar.

**Prioridades recomendadas (al momento de la auditoría):**
1. ~~Cache in-memory con TTL para `resolveFileUrl` (quick win, sin migración).~~ → **IMPLEMENTADO**
2. Forzar paginación en todos los `findAll` (sin limit = riesgo de payload gigante).
3. Paginar servicios en el detalle de activo (actualmente ilimitado).
4. ~~Reemplazar `assertCanStore` por conteo en base de datos (eliminar listing de Supabase en upload path).~~ → **IMPLEMENTADO**
5. ~~Reducir intervalos de refetch del frontend (5s → 30s mínimo).~~ → **IMPLEMENTADO**
6. ~~Implementar `resolveFileUrlForOrg` para validación multi-tenant en archivos.~~ → **IMPLEMENTADO**

**No hay bloqueantes absolutos para demo o bajo volumen.** Antes de sumar varios clientes activos, los problemas restantes (listados sin paginación, queries duplicadas/innecesarias y detalle de activo sin paginar) serán visibles como latencia o payloads excesivos.

---

## Implementación realizada

**Commit:** `835bba4` · **Fecha:** 2026-06-08  
**Scope:** Backend únicamente. Sin cambios de schema, sin migraciones, sin cambios de contrato de API, sin cambios de frontend.

### Qué se implementó

| Hallazgo | Archivo(s) modificado(s) | Descripción |
|----------|--------------------------|-------------|
| P01 — Cache signed URLs | `supabase-storage.service.ts` | `Map<string, {url, expiresAt}>` con TTL = `SIGNED_URL_TTL_SECONDS / 2`. Limpieza oportunística al 1% por `set`. `invalidateSignedUrlCache` invalida entrada al borrar el blob. |
| P02 — assertCanStore con DB | `storage-governance.service.ts` | `assertCanStore` reemplaza el listing de Supabase por `prisma.storedFile.aggregate(_sum: size_bytes)`. Si hay `replacedFileIds`, resta su suma con un segundo aggregate. Sin llamadas a Supabase Storage en el path de upload. |
| P03 — resolveFileUrlForOrg | `stored-files.service.ts` | Nuevo método `resolveFileUrlForOrg(fileId, orgId)` que valida `storedFile.organization_id === organizationId` antes de resolver la URL. Retorna `null` silenciosamente si el archivo no pertenece al org. |
| P03 — propagación | `services.service.ts`, `assets.service.ts`, `dashboard.service.ts`, `users.service.ts`, `companies.service.ts`, `organizations.service.ts` | Todos los callsites de `resolveFileUrl` con `orgId` disponible migrados a `resolveFileUrlForOrg`. |
| P14 — services findOne | `services.service.ts` | `findUnique({ where: { id } })` reemplazado por `findFirst({ where: { id, organization_id: user.orgId } })` para roles no SUPER_ADMIN. Se elimina la validación post-fetch. |
| P15 — assets findOne | `assets.service.ts` | Ídem: `findFirst` con `organization_id` en el where. |
| Storage abstract | `storage.service.ts` | `invalidateSignedUrlCache` implementado como método concreto (no-op) en la clase abstracta para que `LocalStorageService` no requiera cambios. |

### Tests actualizados

- `stored-files.service.spec.ts` — mock existente compatible
- `services.service.spec.ts` — `resolveFileUrlForOrg` añadido al mock de `StoredFilesService`
- `assets.service.spec.ts` — ídem
- `dashboard.service.spec.ts` — ídem
- `storage-governance.service.spec.ts` — tests existentes pasan con el nuevo aggregate

**Resultado:** 35 tests pasando, build limpio (`nest build`).

### Qué NO se implementó (fuera del alcance del PR)

Los hallazgos P04, P05, P06, P10–P13, P16–P19, y las acciones de tipo M (migración) permanecen pendientes. F1/QW4, F2/P08/P09 y F5 ya fueron implementados; F3–F4 permanecen pendientes. Ver sección [Plan de acción recomendado](#plan-de-acción-recomendado).

---

## Alcance revisado

**Backend — servicios revisados:**
- `services/services.service.ts` — findAll, findOne, create, remove, getStats
- `dashboard/dashboard.service.ts` — getStats, getRankingDetails
- `assets/assets.service.ts` — findAll, findOne, create, update, remove, getStats
- `companies/companies.service.ts` (OwnersService) — findAll, findOne, create, update
- `users/users.service.ts` — findAll, findOne, create, update, updateOwnProfile
- `organizations/organizations.service.ts` — findAll, findOne, updateSettings
- `storage/stored-files.service.ts` — resolveFileUrl, resolveFileUrlOrRef, deleteStoredFileAndBlob
- `storage/supabase-storage.service.ts` — resolveFileUrl, uploadFile, deleteFile, getFileSize
- `storage/storage-governance.service.ts` — assertCanStore, getOrganizationUsage, reconcileOrganizationFiles
- `prisma/schema.prisma` — índices de todas las tablas

**Frontend — páginas revisadas:**
- `app/(main)/dashboard/page.tsx`
- `app/(main)/service/page.tsx`
- `app/(main)/assets/page.tsx`
- `app/(main)/assets/[id]/page.tsx`
- `lib/queryAutoRefetch.ts`

---

## Hallazgos priorizados

| ID | Prioridad | Estado | Área | Archivo | Hallazgo | Impacto | Recomendación | Requiere migración | Requiere cambio frontend |
|----|-----------|--------|------|---------|----------|---------|---------------|-------------------|--------------------------|
| P01 | **Crítica** | ✅ **Implementado** | Storage | `supabase-storage.service.ts` | `resolveFileUrl` sin caché: cada llamada hace 1 query DB + 1 llamada HTTP a Supabase `createSignedUrl`. Se invoca N veces por response (1 por adjunto, 1 por thumbnail). | En detalle de activo con 50 servicios × 10 adjuntos = 501 llamadas Supabase por request. Latencia acumulada >10s. | Cache in-memory (`Map`) con TTL = `SIGNED_URL_TTL_SECONDS / 2`. Limpieza oportunística 1%. Invalidación al borrar blob. | No | No |
| P02 | **Crítica** | ✅ **Implementado** | Storage / Upload | `storage-governance.service.ts` | `assertCanStore` listaba TODOS los archivos en Supabase Storage (bucket completo) para calcular uso. | Cada upload ejecutaba un listing completo del bucket. Latencia visible y rate limit risk. | Reemplazado por `prisma.storedFile.aggregate(_sum: size_bytes)`. Sin llamadas Supabase en upload path. | No | No |
| P03 | **Crítica** | ✅ **Implementado** | Multi-tenancy | `stored-files.service.ts` | `resolveFileUrl(storedFileId)` no validaba que el `storedFile` perteneciera al `organization_id` del caller. | Riesgo de fuga de archivos entre organizaciones si un ID se adivina o filtra. | `resolveFileUrlForOrg(fileId, orgId)` implementado y propagado a todos los servicios. | No | No |
| P04 | **Alta** | ⏳ Pendiente | Backend / Services | `services.service.ts:286` | `findAll` sin paginación retorna TODOS los servicios del org sin límite. | Un org con 10.000 servicios retorna un payload de varios MB. El uso frontend para filtros fue eliminado, pero el endpoint sigue aceptando llamadas sin paginación. | Forzar siempre paginación o agregar failsafe de límite máximo en `GET /services`. | No | Sí |
| P05 | **Alta** | ⏳ Pendiente | Backend / Assets | `assets.service.ts:254` | `findAll` sin paginación retorna todos los activos. Mismo patrón que P04. | Mismo impacto. El uso frontend para filtros fue eliminado, pero el endpoint sigue aceptando llamadas sin paginación. | Forzar siempre paginación o agregar failsafe de límite máximo en `GET /assets`. | No | Sí |
| P06 | **Alta** | ⏳ Pendiente | Backend / Assets | `assets.service.ts` | `findOne` carga TODOS los servicios del activo + todos sus adjuntos en una sola query, sin límite ni paginación. | Activo con 200 servicios × 5 adjuntos = 1.000 registros + muchas resoluciones de URL por request. | Paginar servicios en el detalle de activo: `take: 20, orderBy: created_at desc`. Agregar `GET /assets/:id/services?page&limit`. Los índices quedan separados en P16/P17 y deben validarse con `EXPLAIN ANALYZE`. | No | Sí |
| P07 | **Alta** | ✅ **Implementado** | Frontend / Refetch | `frontend/src/lib/queryAutoRefetch.ts` | `fast: 5000ms` (5s) se aplicaba a services list, assets list y asset detail. Con 3 queries activas en services page = 36 llamadas/minuto solo desde esa pantalla. | En producción con 10 usuarios activos = 360 requests/minuto en servicios. Carga innecesaria. | Implementado: `fast: 30000ms`, `detail: 60000ms`, `dashboard: 60000ms`, `refetchOnWindowFocus: false`. La actualización inmediata queda cubierta por `invalidateQueries` post-mutación. | No | No |
| P08 | **Alta** | ✅ **Implementado** | Frontend / Queries | `frontend/src/app/(main)/service/page.tsx` | `["services-workers-list"]` llamaba a `servicesService.findAll()` sin parámetros para construir el dropdown de workers/assets. | Ver P04. | Implementado: `GET /services/filter-options` retorna solo `{ workers: [{ id, name }], assets: [{ id, name }] }` y el frontend usa `servicesService.getFilterOptions()`. | No | No |
| P09 | **Alta** | ✅ **Implementado** | Frontend / Queries | `frontend/src/app/(main)/assets/page.tsx` | `["assets-owners-list"]` llamaba a `assetsService.findAll()` sin parámetros. | Ver P05. | Implementado: `GET /assets/filter-options` retorna solo `{ owners: [{ id, name }] }` y el frontend usa `assetsService.getFilterOptions()`. | No | No |
| P10 | **Alta** | ⏳ Pendiente | Dashboard | `dashboard.service.ts:57` | Dashboard ejecuta 13 queries en paralelo + 2 queries de rankings (total 15 viajes DB por request). Los `groupBy` de `assetsServicedGroups` y `activeOperatorsGroups` cargan todos los IDs en memoria solo para hacer `.length`. | Alto costo por request en dashboard, especialmente con filtros de fecha amplios. | Reemplazar los `groupBy` de conteo por `COUNT DISTINCT` via Prisma. Fusionar los 3 COUNTs de servicios en un solo `groupBy`. | No | No |
| P11 | **Media** | ✅ **Mitigado** (P01) | Dashboard | `dashboard.service.ts` | `getRankingDetails` resuelve avatar URLs de hasta 5 workers. Cada URL = 1 query DB + 1 llamada Supabase. | 5 × 2 = 10 operaciones externas por dashboard request. | Con caché de signed URLs (P01 implementado), los hits de caché reducen esto a 1 query DB por avatar. La llamada Supabase solo ocurre en el primer request. | No | No |
| P12 | **Media** | ⏳ Pendiente | Frontend / Queries | `service/page.tsx:128-141` | La página de servicios lanza 2 queries simultáneas al mismo endpoint con params similares. Ambas se ejecutan aunque solo una sea visible. | 2× carga innecesaria en desktop o mobile. | Detectar viewport antes de decidir qué query ejecutar. `enabled` según breakpoint. | No | Sí |
| P13 | **Media** | ⏳ Pendiente | Backend / Orgs | `organizations.service.ts:24` | `findAll` sin paginación y con resolución de logo URL para cada org. Solo accesible por SUPER_ADMIN pero sin límite. | Con 100+ orgs, retorna 100+ Supabase calls. | Agregar paginación. Con caché de URLs (P01) el impacto ya bajó. | No | No |
| P14 | **Media** | ✅ **Implementado** | Backend / Services | `services.service.ts` | `findOne` cargaba el servicio sin filtro de `organization_id` en la query. La validación se hacía post-fetch. | Permite enumerar IDs de servicios de otros tenants por timing. | `findFirst({ where: { id, organization_id: user.orgId } })` para roles no SUPER_ADMIN. | No | No |
| P15 | **Media** | ✅ **Implementado** | Backend / Assets | `assets.service.ts` | Mismo patrón que P14 en `findOne`. | Ídem. | `findFirst` con `organization_id` en el where. | No | No |
| P16 | **Media** | ⏳ Pendiente | Índices | `schema.prisma` | Falta índice compuesto `(organization_id, is_active, updated_at)` en `Asset`. | Sin este índice, el sort requiere un full scan sobre el índice de `organization_id`. | `@@index([organization_id, is_active, updated_at])` en `Asset`. | Sí | No |
| P17 | **Media** | ⏳ Pendiente | Índices | `schema.prisma` | Falta índice `(organization_id, is_public, status)` en `Service`. | Actualmente se usa `@@index([is_public])` separado, sin beneficio del compound. | `@@index([organization_id, is_public, status])` en `Service`. | Sí | No |
| P18 | **Baja** | ⏳ Pendiente | Backend / Services | `services.service.ts:100` | Loop `for (const file of files)` procesa imágenes secuencialmente (Sharp). | Mayor latencia en creación de servicios con muchas imágenes. | `Promise.all(files.map(...))` para procesamiento paralelo. | No | No |
| P19 | **Baja** | ⏳ Pendiente | Backend / Owners | `companies.service.ts:51` | `attachOwnerUsageCounts` carga todos los assets de todos los owners en memoria y los cruza con un `groupBy`. | Carga extra proporcional al número de assets por org. Para orgs pequeñas no es problema. | Requiere medición con EXPLAIN ANALYZE antes de optimizar. | No | No |

---

## Endpoints críticos revisados

| Endpoint o pantalla | Archivo / backend service | Riesgo detectado | Observación | Acción recomendada |
|---------------------|--------------------------|-----------------|-------------|-------------------|
| `GET /services` (sin paginación) | `services.service.ts:286` | Payload ilimitado | El frontend ya no lo usa para filtros; sigue siendo riesgoso si se llama sin paginación desde otros paths | Forzar paginación o failsafe de límite máximo |
| `GET /assets` (sin paginación) | `assets.service.ts:254` | Payload ilimitado | El frontend ya no lo usa para filtros; sigue siendo riesgoso si se llama sin paginación desde otros paths | Forzar paginación o failsafe de límite máximo |
| `GET /assets/:id` | `assets.service.ts:296` | N+1 Supabase + payload sin límite | Carga todos los servicios + adjuntos del activo | Paginar servicios en detalle |
| `GET /dashboard/stats` | `dashboard.service.ts:15` | 15 queries DB por request, refetch frontend cada 60s | 3 COUNTs de servicios redundantes, 2 groupBy cargando IDs en memoria | Consolidar COUNTs, usar COUNT DISTINCT |
| `POST /services` (con archivos) | `services.service.ts:100` + `storage-governance.service.ts:56` | Patrón original: `assertCanStore` listaba bucket completo | Estado actual: P02 implementado con SUM en DB, sin listing Supabase en path normal de upload | Mantener monitoreo de quota y logs |
| `GET /services/:id` | `services.service.ts:352` | Patrón original: sin filtro tenant en query | Estado actual: P14 implementado con filtro `organization_id` en query | Mantener |
| `GET /assets/:id` | `assets.service.ts:295` | Patrón original: sin filtro tenant en query | Estado actual: P15 implementado con filtro `organization_id` en query | Mantener |
| Dashboard page | `dashboard/page.tsx` | Refetch cada 60s con 1 query | Aceptable si la query es rápida | QW4 implementado; queda optimizar backend dashboard |
| Services page | `service/page.tsx` | 4 queries en mount, 3 con refetch cada 30s | `["services-workers-list"]` usa `/services/filter-options`; ya no carga servicios completos para filtros | Consolidar queries desktop/mobile sigue pendiente |
| Assets page | `assets/page.tsx` | 3 queries en mount, 2 con refetch cada 30s | `["assets-owners-list"]` usa `/assets/filter-options`; ya no carga activos completos para filtros | Consolidar queries sigue pendiente |
| Asset detail page | `assets/[id]/page.tsx` | Refetch cada 30s, carga todos los servicios | `enabled: !!assetId` correcto, pero la query es costosa | Paginar servicios; considerar intervalos por detalle si sigue pesado |

---

## Queries y patrones sospechosos

### 1. `resolveFileUrl` — N+1 en listings y detalles ✅ Mitigado (P01, P03)

> **Estado:** Cache in-memory implementado en `SupabaseStorageService`. `resolveFileUrlForOrg` propagado a todos los callsites. Commit `835bba4`.

**Archivo:** `storage/stored-files.service.ts:52`  
**Función:** `resolveFileUrl(storedFileId?)` / `resolveFileUrlForOrg(storedFileId, orgId)`  
**Explicación:**  
Cada llamada realiza:
1. `prisma.storedFile.findUnique({ where: { id }, select: { storage_ref } })` — 1 query DB
2. `supabase.storage.from(bucket).createSignedUrl(path, ttl)` — 1 llamada HTTP

Se invoca para cada entidad que tiene un archivo asociado:
- `services.service.ts:83` — thumbnail del asset en `findOne`
- `services.service.ts:92` — por cada `attachment` en el service (loop implícito en `Promise.all`)
- `assets.service.ts:46` — thumbnail en `findAll` (por cada asset en la página)
- `assets.service.ts:53-60` — por cada service, por cada attachment en `findOne`
- `dashboard.service.ts:232` — avatar de cada worker en el ranking
- `organizations.service.ts:31` — logo por org en `findAll`
- `companies.service.ts:46` — thumbnail por asset en `findOne` de owner

**Ejemplo del peor caso:**  
`GET /assets/:id` para un activo con 50 servicios y 5 adjuntos cada uno:
- 1 thumbnail del activo
- 50 × 5 = 250 attachments
- **Total: 251 queries DB + 251 llamadas Supabase por un solo request**

**Estado actual:**
Cache in-memory con TTL implementado en commit `835bba4`. `resolveFileUrlForOrg` está propagado en los callsites con `orgId` disponible. El patrón anterior queda como referencia histórica de la auditoría.

---

### 2. Listados sin paginación con `findMany` ilimitado

**Archivo:** `services.service.ts:286`, `assets.service.ts:254`, `organizations.service.ts:25`, `users.service.ts:196`  
**Función:** Rama `else` cuando no hay `page`/`limit`  
**Explicación:**  
Todos estos servicios tienen un path code que retorna `findMany` sin `take` ni `skip`. El frontend de services y assets llama a estos endpoints sin paginación para construir dropdowns de filtros.

```ts
// services.service.ts:286 — retorna TODOS los servicios
const services = await this.prisma.service.findMany({
  where: whereClause,
  include: { worker: ..., asset: ..., attachments: ... },
  orderBy: { created_at: 'desc' }
  // sin take/skip
});
```

**Recomendación:**  
- Agregar `take: Math.min(limit ?? 50, 200)` como máximo por defecto.
- Endpoints `GET /services/filter-options` y `GET /assets/filter-options` implementados; queda pendiente el failsafe de paginación/límite máximo en los `findAll`.

---

### 3. Dashboard — groupBy para contar (carga IDs en memoria)

**Archivo:** `dashboard.service.ts:122-133`  
**Función:** `getStats`  
**Explicación:**  

```ts
// Carga TODOS los asset_ids distintos en memoria para contar
assetsServicedGroups = await this.prisma.service.groupBy({
  by: ['asset_id'],
  where: statsWhere,
  // sin _count ni take — solo para calcular .length
}),

// Mismo patrón para workers
activeOperatorsGroups = await this.prisma.service.groupBy({
  by: ['worker_id'],
  where: statsWhere,
}),
```

En un org con 10.000 servicios en 200 activos, `assetsServicedGroups` retorna 200 filas cargadas en Node.js solo para hacer `.length`. Equivalente SQL ineficiente. Además, hay 3 COUNT separados de servicios:

```ts
this.prisma.service.count({ where: statsWhere }),          // total
this.prisma.service.count({ where: { ...statsWhere, is_public: true } }),   // públicos
this.prisma.service.count({ where: { ...statsWhere, is_public: false } }),  // privados
```

**Recomendación:**  
Usar `$queryRaw` o `groupBy` con `_count` para COUNT DISTINCT. Fusionar los 3 COUNTs:

```ts
const servicesGrouped = await this.prisma.service.groupBy({
  by: ['is_public'],
  where: statsWhere,
  _count: { id: true },
});
```

---

### 4. `assertCanStore` — listing de bucket en cada upload ✅ Implementado (P02)

> **Estado:** Reemplazado por `prisma.storedFile.aggregate(_sum: size_bytes)`. Sin llamadas Supabase Storage en el path de upload. Commit `835bba4`.

**Archivo:** `storage-governance.service.ts`  
**Función:** `assertCanStore`  
**Patrón original detectado en auditoría:**
En cada upload llama a `getOrganizationUsage` → `listOrganizationFileRefs` → `storageService.listFileRefs` → lista recursiva del bucket en Supabase. Luego hace `Promise.all(refs.map(ref => storageService.getFileSize(ref)))` — una llamada Supabase por archivo para obtener el tamaño.

Con 500 archivos en un org, cada upload ejecuta 500+ llamadas Supabase solo para verificar quota.

**Estado actual:**
Implementado con la tabla `StoredFile`, que ya tiene `size_bytes`:

```ts
async assertCanStore(orgId: string, incomingBytes: number, replacedFileIds: string[] = []) {
  const { _sum } = await this.prisma.storedFile.aggregate({
    where: { organization_id: orgId, status: { not: 'DELETED' } },
    _sum: { size_bytes: true },
  });
  const bytesUsed = _sum.size_bytes ?? 0;
  // ... resto de la lógica
}
```

---

### 5. `findOne` de assets — servicios ilimitados con adjuntos

**Archivo:** `assets.service.ts:296`  
**Función:** `findOne`  
**Explicación:**  

```ts
const asset = await this.prisma.asset.findUnique({
  where: { id },
  include: {
    services: {
      include: {
        worker: { select: { name, id } },
        attachments: { select: { id, file_id, file_type } },
      },
      orderBy: { created_at: 'desc' },
      // sin take — TODOS los servicios
    },
    owner: { ... },
  },
});
```

Luego `resolveAssetFileUrls` itera sobre cada service y cada attachment para generar signed URLs. Ver P01.

**Recomendación:**  
Agregar `take: 20` a la inclusión de servicios. Paginar el historial de servicios del activo mediante `GET /assets/:id/services?page=1&limit=20`.

---

### 6. Queries sin filtro tenant en findOne ✅ Implementado (P14, P15)

> **Estado:** `findOne` de services y assets usa `findFirst` con `organization_id` en el `where` para roles no SUPER_ADMIN. Validación post-fetch eliminada. Commit `835bba4`.

**Archivo:** `services.service.ts`, `assets.service.ts`  
**Función:** `findOne`  
**Explicación:**  

```ts
// services.service.ts:352
const service = await this.prisma.service.findUnique({
  where: { id },  // solo por ID, sin organization_id
  include: { ... }
});
// La validación de org ocurre DESPUÉS, línea 366
if (user.role !== 'SUPER_ADMIN' && service.organization_id !== user.orgId) {
  throw new NotFoundException(...);
}
```

Esto permite que un atacante enumere IDs de servicios de otros tenants: puede detectar si un ID existe (respuesta inmediata con 404) vs. si pertenece a otro org (también 404, pero con datos cargados). El timing puede diferir.

**Recomendación:**  
Incluir el filtro de org directamente en la query para usuarios no SUPER_ADMIN:

```ts
const service = await this.prisma.service.findFirst({
  where: {
    id,
    ...(user.role !== 'SUPER_ADMIN' ? { organization_id: user.orgId } : {}),
  },
  include: { ... }
});
```

---

## Multi-tenancy y seguridad de consultas

### Lugares correctos

- `services.service.ts:findAll` — el `whereClause` siempre incluye `organization_id` para roles no SUPER_ADMIN.
- `assets.service.ts:findAll` — `baseWhere.organization_id = orgId` para no SUPER_ADMIN.
- `users.service.ts:findAll` — `where.organization_id = currentUser.orgId` para ADMINs.
- `companies.service.ts:findAll` — `where: { organization_id: orgId }`.
- `companies.service.ts:findOne` — valida `owner.organization_id !== orgId`.
- `users.service.ts:findOne` — valida `user.organization_id !== currentUser.orgId` para ADMIN.
- Guards de EXTERNAL role en services y assets son correctos.

### Lugares mejorables

**`findOne` sin org en query (P14, P15):**  
Patrón original detectado en auditoría: ambos `services.findOne` y `assets.findOne` hacían fetch por ID sin filtro de org y validaban post-fetch. Estado actual: P14 y P15 están implementados en commit `835bba4`; ambos usan filtro tenant en la query para roles no SUPER_ADMIN.

**`resolveFileUrl` sin validación de org (P03):**  
Patrón original detectado en auditoría: el método `resolveFileUrl(storedFileId)` en `stored-files.service.ts` no recibía ni validaba el `organization_id`. Estado actual: P03 está implementado en commit `835bba4` mediante `resolveFileUrlForOrg`, propagado a todos los servicios con `orgId` disponible.

Ejemplo de riesgo teórico:
```
POST /services { asset_id: "asset-de-otro-org" }
→ si la validación falla tarde, podría haber llamadas internas con IDs externos
```

### ✅ Implementado: `resolveFileUrlForOrg` (commit `835bba4`)

`StoredFilesService.resolveFileUrlForOrg` está implementado y activo en todos los servicios. El código de referencia es:

```ts
async resolveFileUrlForOrg(
  storedFileId: string | null | undefined,
  organizationId: string,
): Promise<string | null> {
  if (!storedFileId) return null;
  const storedFile = await this.prisma.storedFile.findUnique({
    where: { id: storedFileId },
    select: { storage_ref: true, organization_id: true },
  });
  if (!storedFile || storedFile.organization_id !== organizationId) {
    return null; // no lanzar error para no leak de existencia
  }
  return this.storageService.resolveFileUrl(storedFile.storage_ref);
}
```

La migración de `resolveFileUrl` → `resolveFileUrlForOrg` está completada en todos los servicios con `orgId` disponible: `services.service.ts`, `assets.service.ts`, `dashboard.service.ts`, `users.service.ts`, `companies.service.ts`, `organizations.service.ts`.

---

## Supabase Storage y signed URLs

### Patrón original detectado en auditoría

> **Estado actual:** cache in-memory implementado en commit `835bba4`.

```
Request → findUnique(storedFileId) → createSignedUrl(path, ttl=3600s)
```

- **TTL configurado:** 3600s (1 hora), correcto.
- **Cache original:** Ninguno. Cada request generaba una nueva URL aunque la anterior siguiera siendo válida.
- **Llamadas por request (ejemplos reales):**
  - `GET /services` (20 items): 20 thumbnails + 20 × N attachments = 20–200+ llamadas
  - `GET /assets` (10 items): 10 thumbnails = 10 llamadas
  - `GET /assets/:id` (50 servicios, 5 adj c/u): 251 llamadas
  - `GET /dashboard/stats`: 5 avatars = 5–10 llamadas

### Riesgo de latencia

Cada `createSignedUrl` es una llamada HTTP a Supabase (~50-200ms de latencia). En el peor caso (asset detail con historial largo):
- 251 llamadas × ~100ms promedio = **~25 segundos solo en signed URLs**
- En producción con concurrencia = posible rate limiting de Supabase API

### ✅ Implementado: Cache in-memory con TTL (commit `835bba4`)

Implementado en `SupabaseStorageService`. El código implementado:

```ts
// En SupabaseStorageService
private readonly urlCache = new Map<string, { url: string; expiresAt: number }>();
private readonly CACHE_TTL_MS: number; // = signedUrlTtlSeconds * 0.5 * 1000

async resolveFileUrl(fileRef: string): Promise<string> {
  const cached = this.urlCache.get(fileRef);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }
  
  // ... lógica actual de createSignedUrl ...
  const url = data.signedUrl;
  
  this.urlCache.set(fileRef, {
    url,
    expiresAt: Date.now() + this.CACHE_TTL_MS,
  });
  
  return url;
}
```

**TTL usado:** `Math.floor(SIGNED_URL_TTL_SECONDS * 0.5) * 1000` ms. Garantiza que la URL en caché expire antes que la URL real de Supabase.

**Limpieza de caché:** Limpieza oportunística con probabilidad 1% en cada `set` (sin `setInterval` para mantener el servicio stateless-friendly).

**Pantallas más afectadas (ranking de impacto):**
1. Asset detail (`/assets/:id`) — hasta 500+ URLs por request
2. Services list (`/services`) — 20–100 URLs por página
3. Assets list (`/assets`) — 10–50 URLs por página
4. Dashboard — 5–10 URLs por request
5. Users list — N avatars por página

**Impacto esperado del cache:**  
Con `staleTime: 1800s` (30min), el 95%+ de requests serían hits de cache, reduciendo llamadas Supabase en >90%.

---

## Índices recomendados

| Índice sugerido | Tabla | Columnas | Query / endpoint que lo justifica | Prioridad | SQL / Prisma | Riesgo |
|----------------|-------|----------|----------------------------------|-----------|-------------|--------|
| `idx_asset_org_active_updated` | `Asset` | `(organization_id, is_active, updated_at DESC)` | `GET /assets`: `WHERE organization_id=? ORDER BY is_active DESC, updated_at DESC` | **Alta** | `@@index([organization_id, is_active, updated_at])` | Bajo — índice de lectura |
| `idx_service_org_public_status` | `Service` | `(organization_id, is_public, status)` | Queries de usuarios EXTERNAL: `WHERE organization_id=?, is_public=true, status='COMPLETED'` | **Media** | `@@index([organization_id, is_public, status])` | Bajo |
| `idx_service_org_worker_created` | `Service` | `(organization_id, worker_id, created_at DESC)` | Queries filtradas por worker con rango de fecha | **Media** | `@@index([organization_id, worker_id, created_at])` | Bajo |
| `idx_owner_org_active` | `Owner` | `(organization_id, is_active)` | `GET /owners`: `WHERE organization_id=? ORDER BY is_active DESC` | **Baja** | `@@index([organization_id, is_active])` | Bajo |
| `idx_user_org_active_updated` | `User` | `(organization_id, is_active, updated_at DESC)` | `GET /users`: `WHERE organization_id=? ORDER BY is_active DESC, updated_at DESC` | **Baja** | `@@index([organization_id, is_active, updated_at])` | Bajo |

**Nota:** Los índices existentes en `Service` (`organization_id`, `organization_id, created_at`, `asset_id`, `worker_id`, etc.) son correctos y bien definidos. Los índices en `User` también tienen buena cobertura. Los cambios propuestos son adiciones selectivas para los patrones de ordenamiento específicos observados, **no reemplazos**. Antes de migrar, verificar con `EXPLAIN ANALYZE` en producción con datos reales.

**Índices NO recomendados sin evidencia adicional:**
- `(organization_id, deleted_at)` — el schema no usa soft delete (`deleted_at`)
- `(service_id, created_at)` en `ServiceAttachment` — el join siempre va por `service_id` (ya indexado) y no se ordena por `created_at` en ese nivel

---

## Frontend / React Query

### 1. Intervalos de refetch demasiado agresivos

**Archivo:** `lib/queryAutoRefetch.ts`

```ts
export const AUTO_REFETCH_INTERVALS = {
  fast: 5000,      // 5s — services, assets, asset detail
  detail: 10000,   // 10s — no usado actualmente
  dashboard: 15000, // 15s — dashboard
};
```

Con `refetchOnWindowFocus: true` adicional, la carga real es mayor. En la página de servicios hay **4 queries activas** con intervalos de 5-15s.

**Implementado:**
```ts
export const AUTO_REFETCH_INTERVALS = {
  fast: 30000,      // 30s
  detail: 60000,    // 60s
  dashboard: 60000, // 60s
};

export const AUTO_REFETCH_OPTIONS = {
  refetchOnWindowFocus: false,
  refetchIntervalInBackground: false,
};
```
La actualización inmediata depende de `queryClient.invalidateQueries` post-mutación; las mutaciones existentes de services/assets/uploads ya invalidan las queries afectadas. `refetchOnWindowFocus` queda desactivado para evitar requests extra al volver a la pestaña.

---

### 2. Queries duplicadas para desktop y mobile en Services

**Archivo:** `service/page.tsx:128-141`

```tsx
// Desktop
const { data: responseData } = useQuery({
  queryKey: ["services", queryParams],
  queryFn: () => servicesService.findAll(queryParams),
  refetchInterval: AUTO_REFETCH_INTERVALS.fast,
  ...AUTO_REFETCH_OPTIONS,
});

// Mobile (query separada, siempre activa aunque estés en desktop)
const { data: mobileResponseData } = useQuery({
  queryKey: ["services-mobile", mobileQueryParams],
  queryFn: () => servicesService.findAll(mobileQueryParams),
  refetchInterval: AUTO_REFETCH_INTERVALS.fast,
  ...AUTO_REFETCH_OPTIONS,
});
```

Ambas queries están activas simultáneamente independientemente del viewport. En desktop = 2 requests donde solo 1 es necesario.

**Recomendación:**
```tsx
const isMobile = useMediaQuery('(max-width: 1023px)'); // hook de media query

const { data } = useQuery({
  queryKey: isMobile ? ["services-mobile", mobileParams] : ["services", desktopParams],
  queryFn: () => servicesService.findAll(isMobile ? mobileParams : desktopParams),
  enabled: true,
});
```

O usar un solo query con params que sirvan para ambos vistas.

---

### 3. Query de dataset completo para dropdowns

**Archivo:** `service/page.tsx:156-161`, `assets/page.tsx:120-125`

```tsx
// Estado anterior: cargaba TODOS los servicios para extraer workers/assets únicos
const { data: serviceFilterOptions } = useQuery({
  queryKey: ["services-workers-list"],
  queryFn: () => servicesService.getFilterOptions(),
  staleTime: 300000,
  ...AUTO_REFETCH_OPTIONS,
});
```

Estado actual: implementado para services y assets. Los dropdowns usan endpoints livianos y ya no llaman `findAll()` sin parámetros.

**Implementado:**
- `GET /services/filter-options` retorna `{workers: [{id, name}], assets: [{id, name}]}`.
- `GET /assets/filter-options` retorna `{owners: [{id, name}]}`.
- Ambos respetan tenant/visibilidad y no resuelven signed URLs.

---

### 4. Asset detail — todos los servicios cargados, filtrado en cliente

**Archivo:** `assets/[id]/page.tsx:192-198`, filtros en `useMemo:208-247`

```tsx
const { data: asset } = useQuery({
  queryKey: ["asset", assetId],
  queryFn: () => assetsService.findOne(assetId),
  enabled: !!assetId,
  refetchInterval: AUTO_REFETCH_INTERVALS.fast, // 30s tras QW4
  ...AUTO_REFETCH_OPTIONS,
});
// Filtros de workers y fecha se aplican en cliente sobre todos los servicios cargados
```

Todo el historial de servicios se carga en el cliente y se filtra en memoria. Con QW4 implementado, este endpoint potencialmente costoso se ejecuta cada 30 segundos; la paginación del historial sigue pendiente en P06/F4.

**Recomendación:**
- Reducir refetchInterval a 60s.
- Mover filtros al servidor: `GET /assets/:id/services?worker_id=&startDate=&endDate=&page=&limit=`.
- El componente solo renderiza los servicios de la página actual.

---

### 5. `queryKey` del dashboard incluye objeto `dateRange`

**Archivo:** `dashboard/page.tsx:42-50`

```tsx
const { data: stats } = useQuery({
  queryKey: ["dashboard-stats", dateRange], // dateRange es un objeto {start?, end?}
  ...
});
```

React Query serializa `dateRange` correctamente como parte de la key, por lo que los cambios de preset siempre generan un nuevo fetch. Esto es correcto funcionalmente, pero cuando `dateRange` cambia (usuario selecciona preset diferente) + refetchInterval activo = la query anterior se abandona y la nueva comienza desde cero.

**Recomendación:** El comportamiento es correcto. Considerar añadir `staleTime: 30000` para evitar refetch innecesario si el usuario vuelve al mismo preset.

---

## Métricas recomendadas para MVP

| Pantalla / operación | Métrica objetivo | Referencia |
|---------------------|-----------------|------------|
| Dashboard (carga inicial) | < 500ms TTFB | Con cache de signed URLs |
| Dashboard (refetch) | < 300ms | Query ya en caché |
| Listado de servicios (20 items) | < 800ms | Con paginación y cache |
| Detalle de servicio | < 600ms | |
| Detalle de activo (20 servicios, 5 adj c/u) | < 1.5s | Con cache de URLs; hoy puede ser >10s |
| Upload de evidencia (1 img 2MB) | < 3s | Incluye Sharp + Supabase upload |
| Upload de evidencia (10 imgs) | < 8s | |
| Generación de signed URL (con cache) | < 5ms | Hit de cache in-memory |
| Generación de signed URL (cache miss) | < 300ms | Round-trip Supabase |
| Payload promedio listado (20 items con URLs) | < 50KB | |
| Payload detalle de activo (20 servicios) | < 100KB | |

---

## Instrumentación recomendada

### 1. Interceptor de timing en NestJS

Agregar temporalmente en `app.module.ts` para staging:

```ts
@Injectable()
export class TimingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const req = context.switchToHttp().getRequest();
    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        if (ms > 500) {
          console.warn(`[SLOW] ${req.method} ${req.url} — ${ms}ms`);
        }
      }),
    );
  }
}
```

---

### 2. Logging temporal de queries Prisma

En `prisma.service.ts`, habilitar en staging:

```ts
this.$use(async (params, next) => {
  const before = Date.now();
  const result = await next(params);
  const after = Date.now();
  if (after - before > 200) {
    console.warn(`[SLOW QUERY] ${params.model}.${params.action} — ${after - before}ms`);
  }
  return result;
});
```

---

### 3. Logging de signed URLs generadas

En `stored-files.service.ts`:

```ts
async resolveFileUrl(storedFileId?: string | null): Promise<string | null> {
  if (!storedFileId) return null;
  const start = Date.now();
  // ... lógica actual ...
  const ms = Date.now() - start;
  if (ms > 200) {
    this.logger.warn(`resolveFileUrl(${storedFileId}) took ${ms}ms`);
  }
  return url;
}
```

---

### 4. Payload size logging

```ts
// En el interceptor de timing
const res = context.switchToHttp().getResponse();
res.on('finish', () => {
  const size = parseInt(res.getHeader('content-length') ?? '0', 10);
  if (size > 100_000) { // >100KB
    console.warn(`[LARGE PAYLOAD] ${req.method} ${req.url} — ${(size/1024).toFixed(1)}KB`);
  }
});
```

---

### 5. Medición en Supabase

1. Activar `pg_stat_statements` en el dashboard de Supabase → Database → Reports.
2. Consultar las queries más lentas:
```sql
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```
3. Para índices específicos:
```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM "Service"
WHERE organization_id = 'xxx'
ORDER BY is_active DESC, updated_at DESC
LIMIT 10 OFFSET 0;
```

---

## Plan de acción recomendado

### 1. Quick wins sin migración (sin cambios de schema/contrato)

| # | Estado | Acción | Archivo | Esfuerzo estimado |
|---|--------|--------|---------|------------------|
| QW1 | ✅ **Hecho** (commit `835bba4`) | Cache in-memory para `resolveFileUrl` con TTL = `SIGNED_URL_TTL_SECONDS / 2` | `supabase-storage.service.ts` | — |
| QW2 | ✅ **Hecho** (commit `835bba4`) | Reemplazar `assertCanStore` con SUM en `StoredFile` | `storage-governance.service.ts` | — |
| QW3 | ✅ **Hecho** (commit `835bba4`) | Implementar `resolveFileUrlForOrg` y usarlo en todos los servicios | `stored-files.service.ts` + 6 servicios | — |
| QW4 | ✅ **Hecho** | Reducir `AUTO_REFETCH_INTERVALS` en frontend | `frontend/src/lib/queryAutoRefetch.ts` | — |
| QW5 | ✅ **Hecho** (commit `835bba4`) | Añadir filtro `organization_id` en `findOne` de services y assets | `services.service.ts`, `assets.service.ts` | — |
| QW6 | ⏳ Pendiente | Consolidar 3 COUNTs de servicios en dashboard en un solo `groupBy` | `dashboard.service.ts` | 1h |
| QW7 | ⏳ Pendiente | Reemplazar `groupBy` sin `_count` por `COUNT DISTINCT` en dashboard | `dashboard.service.ts` | 1h |

---

### 2. Cambios que requieren migración de schema / nueva ruta API

| # | Acción | Impacto | Esfuerzo |
|---|--------|---------|---------|
| M1 | Índice `(organization_id, is_active, updated_at)` en `Asset` | Media query más rápida | 30min + migration |
| M2 | Índice `(organization_id, is_public, status)` en `Service` | External user queries | 30min + migration |
| M3 | ✅ **Hecho**: endpoint `GET /services/filter-options` (solo id/name de workers y assets) | Elimina query ilimitada del frontend | — |
| M4 | ✅ **Hecho**: endpoint `GET /assets/filter-options` (solo id/name de owners) | Elimina query ilimitada del frontend | — |
| M5 | Endpoint `GET /assets/:id/services?page&limit&worker_id&startDate&endDate` | Paginar historial de activo | 3-4h + frontend |
| M6 | Forzar max `take: 200` en todos los `findAll` sin paginación como failsafe | Limitar payloads grandes | 2h |

---

### 3. Cambios frontend

| # | Acción | Archivo | Esfuerzo |
|---|--------|---------|---------|
| F1 | ✅ **Hecho**: reducir intervalos de refetch | `frontend/src/lib/queryAutoRefetch.ts` | — |
| F2 | ✅ **Hecho**: usar endpoint `/filter-options` para dropdowns | `service/page.tsx`, `assets/page.tsx` | — |
| F3 | Unificar queries desktop/mobile en services page | `service/page.tsx` | 2-3h |
| F4 | Paginar historial de servicios en asset detail | `assets/[id]/page.tsx` | 4h |
| F5 | ✅ **Hecho**: `refetchOnWindowFocus` desactivado en opciones compartidas | `frontend/src/lib/queryAutoRefetch.ts` | — |

---

### 4. Cambios futuros de observabilidad

| # | Acción | Notas |
|---|--------|-------|
| O1 | Integrar OpenTelemetry o Pino con trace IDs en NestJS | Trazabilidad end-to-end |
| O2 | Alertas en Railway por latencia >1s en endpoints críticos | Railway Metrics |
| O3 | Dashboard de Supabase `pg_stat_statements` en staging | Requiere activar extensión |
| O4 | Registro de uso de quota en DB en lugar de Supabase listing | Evitar la llamada costosa definitivamente |

---

## Checklist de validación

### Local

- [x] `cd backend && npm run build` pasa sin errores *(commit `835bba4`)*
- [ ] `cd frontend && npm run build` pasa sin errores
- [x] Tests unitarios backend pasan: `npm run test` — 35/35 *(commit `835bba4`)*
- [ ] E2E tests backend pasan: `npm run test:e2e`
- [x] Cache de signed URLs implementado (`SupabaseStorageService.signedUrlCache`) *(commit `835bba4`)*
- [x] `assertCanStore` ya no llama `listFileRefs` ni ninguna operación de Supabase Storage *(commit `835bba4`)*
- [x] `resolveFileUrlForOrg` propagado a todos los servicios con `orgId` disponible *(commit `835bba4`)*
- [x] `findOne` de services y assets usa `findFirst` con `organization_id` en el where *(commit `835bba4`)*
- [x] Endpoints de filter-options retornan solo id/name sin URLs firmadas

### Staging

- [ ] Interceptor de timing activo y logueando en Railway staging
- [ ] `EXPLAIN ANALYZE` ejecutado para queries de assets y services con datos representativos
- [ ] Payload size de `/assets/:id` verificado con activo con >20 servicios
- [ ] Signed URL cache hit rate visible en logs (>90% hit rate esperado en segundo request)
- [ ] `assertCanStore` ejecutado en upload: verificar que los logs NO muestran llamadas a `listFileRefs`

### Producción

- [ ] Cache de signed URLs desplegado y monitorizado
- [ ] Reducción de llamadas a Supabase Storage API visible en Supabase Dashboard → Storage → Usage
- [ ] Intervalos de refetch reducidos desplegados *(QW4 implementado; pendiente despliegue)*
- [ ] No hay regresión en funcionalidad de uploads
- [ ] Signed URLs siguen funcionando correctamente (TTL respetado, las URLs en caché no están expiradas)
- [ ] Filtros de multi-tenant (`resolveFileUrlForOrg`) activos y sin errores en Railway logs

### Supabase

- [ ] Revisar `pg_stat_statements` para las queries de dashboard y servicios
- [ ] Confirmar que `SIGNED_URL_TTL_SECONDS` >= 600 en producción (ya validado en código)
- [ ] Verificar que no haya rate limits en Storage API (ver Supabase Dashboard → Storage → Usage)

### Vercel (frontend)

- [ ] Build limpio con nuevo `queryAutoRefetch.ts`
- [ ] Verificar en Network tab del browser que refetch se ejecuta a 30s (no 5s)
- [ ] Verificar que no hay llamadas duplicadas al montar páginas de services y assets
- [ ] Assets page con infinite scroll mobile funciona con cambios

### Railway (backend)

- [ ] Logs de Railway no muestran errores de Supabase Storage en llamadas a `listFileRefs`
- [ ] Tiempos de respuesta en Railway reducidos (visible en Railway Metrics)
- [ ] Memoria de Node.js estable (cache in-memory no crece ilimitadamente)

---

## Fuera de alcance

- **No se implementan nuevas features** de la aplicación en esta auditoría.
- **No se refactoriza el storage completo** — solo se optimiza la resolución de URLs y el cálculo de quota.
- **No se migra auth** — el sistema de JWT/sesiones no se modifica.
- **No se cambia el contrato público de API** — los endpoints existentes mantienen su firma. Los nuevos endpoints (`/filter-options`, `/assets/:id/services`) son adiciones, no reemplazos.
- **No se propone reemplazar Supabase Storage** — las optimizaciones son compatibles con el proveedor actual.
- **No se evalúa CDN** — la entrega de imágenes a usuarios finales vía CDN queda fuera de este alcance.
- **No se refactoriza el procesamiento de imágenes** (Sharp) — el hardening actual es correcto y suficiente.

---

## Notas adicionales

### Fallas preexistentes documentadas

Durante la auditoría de código no se ejecutó la suite de tests completa (requiere entorno con DB y Supabase). Si existe algún test E2E fallando por configuración de entorno, no está relacionado con los hallazgos de este documento.

### Bug potencial en `storageGovernance.assertCanStore` — resuelto en `835bba4`

El patrón original llamaba a `getOrganizationUsage`, hacía listing del bucket de Supabase y luego obtenía el tamaño de CADA archivo individualmente. Además de ser lento, tenía un **race condition teórico**: entre el listing y la verificación, otro upload podía completarse, haciendo que la quota se excediera levemente. Estado actual: la solución basada en `StoredFile.size_bytes` fue implementada en commit `835bba4` y elimina el listing de Supabase del path normal de upload.

### `StoredFileStatus` no completamente utilizado

El schema define `StoredFileStatus { READY, DELETING, DELETED, FAILED }` pero el código no actualiza el status durante el ciclo de vida del archivo (solo usa el default `READY`). Esto no es un problema de performance, pero limita la capacidad de auditoría. Se documenta como tech debt.

### Recomendación de siguiente PR

~~**PR prioritario:** Implementar cache de signed URLs en `SupabaseStorageService` + reemplazar `assertCanStore` con suma en DB. Ambos cambios están en el backend, no requieren migración de schema, y tienen el mayor impacto en latencia visible para el usuario.~~ → **Implementado en commit `835bba4`.**

**PR siguiente recomendado (backend):** Consolidar los 3 COUNTs de servicios en `dashboard.service.ts` en un único `groupBy` (QW6) y reemplazar los `groupBy` de conteo de activos/operadores por `COUNT DISTINCT` (QW7). Sin migraciones, bajo riesgo, impacto en el endpoint más frecuente.

**PR siguiente recomendado (frontend):** Abordar P12/F3 para evitar queries desktop/mobile simultáneas en Services. Mantener P06/F4 para un PR posterior por su mayor alcance.
