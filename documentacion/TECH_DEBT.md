# Technical Debt — Recall

**Última actualización:** 2026-06-07 (backups Supabase agregado)

---

## Estado general

- Las vulnerabilidades críticas multi-tenant (SEC-01..07) fueron cerradas y validadas.
- Las constraints de integridad en producción están aplicadas.
- La decisión de email global único fue aceptada e implementada para MVP.
- `worker_restricted_access` queda documentado como feature futura, sin promesa rota al usuario.
- Este documento lista únicamente deuda técnica pendiente y aceptada conscientemente.

---

## Deuda técnica priorizada

| # | Prioridad | Área | Deuda | Riesgo | Cuándo abordarla |
|---|---|---|---|---|---|
| 1 | Alta | Seguridad / Auth | JWT en `localStorage` y cookie accesible por JS | Robo de token ante XSS exitoso | Antes de producción con clientes reales |
| 2 | Alta | Tests / CI | Specs con mocks Prisma desactualizados | Tests no confiables como gate de deploy | Antes de activar CI como gate |
| 3 | Media | Storage | `resolveFileUrlForOrg` sin contexto de tenant | Defensa en profundidad — sin vulnerabilidad activa conocida | Antes de escalar a múltiples tenants activos |
| 4 | Media | Storage | Limpieza automática de archivos huérfanos | Crecimiento de storage sin entidad asociada | Antes de operación sostenida en producción |
| 5 | Media | API | Respuestas inconsistentes entre endpoints | Frontend difícil de mantener, errores UX | Antes de estabilizar API pública o integraciones externas |
| 6 | Producto | Permisos | `worker_restricted_access` no implementado | Bajo — sin promesa rota al usuario actual | Solo si un cliente pide restricción por operario |
| 7 | Producto | Auth | Email por tenant (vs email global actual) | Bajo — decisión consciente para MVP | Si aparecen usuarios multi-org o SSO/SAML |
| 8 | Docs | API | `API_CONTRACTS.md` puede desalinearse | Documentación contradictoria con backend | Con cada cambio de endpoints, DTOs o auth flows |
| 9 | Docs / QA | Tests | Guía QA aspiracional sin pipeline real | Documentación que no refleja el estado real | Cuando exista pipeline de pruebas estable |
| 10 | **Alta** (temporal) | Infraestructura / DB | Backups Supabase — sin backup automático en plan Free | Pérdida total de datos ante corrupción, migración fallida o fallo de base | Antes de cliente pago, segundo cliente o uso operacional real |

---

## Detalle por ítem

### 1 — JWT en `localStorage` / cookie JS-accesible

**Riesgo:** Un XSS exitoso permite robo del token hasta su expiración (12h). Las sesiones tienen revocación server-side como mitigación parcial.

**Solución:** Migrar a cookie `HttpOnly`, `Secure`, `SameSite=Strict`. El backend emitiría la cookie en login y la limpiaría en logout. El frontend dejaría de leer el token directamente desde JS.

**Áreas afectadas al implementar:**
- `frontend/`: login, logout, `AuthContext`, cliente HTTP (`api.ts`), 2FA flow, redirecciones de sesión
- `backend/src/auth/`: `login`, `logout`, `register`, `2fa/login`, CORS (`credentials: true`, `origin` explícito)
- Sesiones/dispositivos: el guard de sesión sigue funcionando igual; solo cambia cómo llega el token

---

### 2 — Specs con mocks Prisma desactualizados

**Estado:** 4 errores de TypeScript preexistentes en `*.spec.ts`. Los archivos de producción compilan sin errores.

**Archivos afectados:**
- `backend/src/organizations/organizations.service.spec.ts` — mock usa `auto_publish_jobs` (campo renombrado)
- `backend/src/services/services.service.spec.ts` — mock de `prisma.service.create` no tipado como `Prisma__ServiceClient`

**Riesgo:** `npm run test` reporta fallos de tipo que no reflejan bugs reales, lo que dificulta usar el test suite como gate confiable en CI.

---

### 3 — `resolveFileUrlForOrg(storedFileId, organizationId)`

**Estado actual:** `StoredFilesService.resolveFileUrl(storedFileId)` no filtra por `organization_id`. No hay vulnerabilidad activa — todos los callsites reciben el `storedFileId` de entidades ya validadas por tenant. El caso concreto del dashboard fue mitigado (ranking de workers filtra por `organization_id`).

**Solución:** Añadir método `resolveFileUrlForOrg(storedFileId, organizationId)` que verifique `storedFile.organization_id === organizationId` antes de firmar la URL.

**Áreas afectadas (13 callsites):**
- `StoredFilesService` — nuevo método
- `assets.service.ts`, `services.service.ts`, `users.service.ts`, `companies.service.ts`, `organizations.service.ts`, `auth.service.ts`, `dashboard.service.ts`

---

### 4 — Limpieza automática de archivos huérfanos

**Estado actual:** `StorageGovernanceService` tiene reconciliación manual (`POST /organizations/me/storage/reconcile`). No hay job programado.

**Riesgo:** Si una operación falla a mitad (upload completado, registro en DB fallido), el blob queda en Supabase sin `StoredFile` asociado. Acumula costo y cuota.

**Solución:** Job periódico (cron o queue) que liste blobs en Supabase y los cruce con `StoredFile`. Borrar huérfanos con antigüedad > N días.

---

### 5 — Respuestas inconsistentes de API

**Ejemplos conocidos:**
- Algunos listados devuelven `[]` o `{ data, meta }` según si se pasa paginación o no.
- `DELETE /services/:id` es borrado físico; `DELETE /assets/:id` y `DELETE /owners/:id` son soft delete. No hay convención uniforme.
- Algunos endpoints devuelven el objeto completo, otros devuelven solo `{ message, id }`.

**Cuándo abordar:** antes de publicar SDK, integraciones externas o estabilizar versión pública de la API.

---

### 6 — `worker_restricted_access` (feature futura)

**Estado actual:**
- Campo `worker_restricted_access Boolean @default(false)` existe en `Organization`.
- Tabla `WorkerAssetAccess` existe en el schema.
- El DTO acepta el campo y lo guarda en DB.
- El backend **nunca lo lee** en ninguna query.
- La UI de settings **no tiene toggle** para esta opción.
- `@default(false)` → comportamiento actual sin restricciones: workers ven todos los assets activos del tenant.

**Riesgo actual:** Bajo. No hay promesa rota porque el control no está expuesto en la UI.

**Antes de implementar, definir:**
- ¿Un worker sin assets asignados ve cero activos o todos?
- ¿La restricción aplica a qué assets puede ver o también a qué servicios puede crear?
- ¿La restricción es a nivel org (todos los workers) o por usuario individual?
- ¿Cómo asigna un ADMIN activos a un worker específico?

**Archivos que cambiarían:**
- `assets.service.ts` — `findAll` y `findOne`
- `services.service.ts` — `findAll` y `create`
- `users.service.ts` o nuevo controller — CRUD de `WorkerAssetAccess`
- `settings/page.tsx` — añadir toggle (solo después de implementar backend)

---

### 7 — Email por tenant (reconsideración futura)

**Decisión actual:** `User.email @unique` — un email = una cuenta en todo Recall. Un usuario pertenece a una sola organización.

**Cuándo reconsiderar:**
- Un usuario necesita pertenecer a múltiples organizaciones con el mismo email.
- Se introduce SSO/SAML (la identidad externa ya gestiona unicidad).
- Aparecen consultores o usuarios con roles en múltiples tenants.

**Impacto si se cambia:**
- Prisma: `@unique` en email → `@@unique([email, organization_id])` + migración
- Login: necesita contexto de org (subdomain, selector, o campo extra)
- Forgot-password: necesita saber a qué org pertenece el usuario
- Invitaciones: la validación de email ya existente en otra org cambia de comportamiento
- JWT: `sub` deja de ser global; se vuelve `(user_id, org_id)`
- Sesiones y 2FA: requieren rediseño para aislar por `(user, org)`

---

### 8 — `API_CONTRACTS.md` debe mantenerse actualizado

`API_CONTRACTS.md` fue corregido al cierre de esta sesión. Es propenso a desalinearse con el backend a medida que se añadan endpoints, cambien DTOs o evolucione el auth flow.

**Regla:** actualizar `API_CONTRACTS.md` en el mismo PR que agregue o modifique un endpoint.

---

### 9 — Guía QA / E2E

La guía QA anterior fue eliminada por estar desactualizada (SQLite, header injection sin JWT, endpoints inexistentes). No se reemplaza hasta que exista un pipeline de pruebas E2E estable y ejecutable.

---

### 10 — Backups Supabase / recuperación de datos

**Prioridad:** Alta mientras se mantenga Supabase Free.

**Estado actual:** El proyecto corre sobre Supabase Free, que **no incluye backups automáticos**. No existe Point-in-Time Recovery (PITR) ni exportación programada de datos.

**Decisión temporal:** Se acepta este riesgo durante el mes actual porque el cliente existente usa el sistema como demo. En ese contexto, una pérdida de datos sería recuperable manualmente y no tendría impacto operacional crítico.

**Riesgo:** Pérdida total o parcial de datos ante:
- Corrupción accidental de la base de datos.
- Borrado accidental de registros o tablas.
- Migración Prisma fallida que deje la DB en estado inconsistente.
- Fallo o incidente en la infraestructura de Supabase.

**Mitigación temporal:**
- Evitar operaciones destructivas en producción (migraciones con DROP, seeds, borrados masivos).
- Si la demo avanza hacia uso operacional real, exportar manualmente los datos críticos desde el SQL Editor de Supabase antes de cada migración relevante (`pg_dump` o exportación CSV desde el dashboard).

**Criterio de cierre:** Este ítem se cierra cuando se cumpla una de estas condiciones antes de cualquiera de los eventos listados abajo:
- Subir a Supabase Pro (incluye PITR y backups diarios automáticos), o
- Implementar backup externo automatizado (ej. exportación programada a S3/R2).

**Eventos que fuerzan el cierre antes de que ocurran:**
- Primer cliente pago.
- Segundo cliente (sea demo o pago).
- Uso operacional real de datos (no demo).
- Carga de datos críticos de producción.

**Áreas afectadas:** Supabase DB, historial de migraciones Prisma, plan de recuperación ante incidentes, operación.

> Esta deuda no bloquea la demo actual, pero sí bloquea escalar a clientes reales o múltiples clientes sin una estrategia de backup.

---

## Fuera de alcance — hallazgos ya cerrados

Los siguientes ítems estuvieron en auditorías anteriores y **ya fueron resueltos**. No se listan como deuda:

| Ítem | Estado |
|---|---|
| `PATCH /assets/:id` aceptaba `any` (SEC-01) | ✅ Cerrado — `UpdateAssetDto` estricto |
| `PATCH /services/:id` permitía cambiar `asset_id` (SEC-02) | ✅ Cerrado — `asset_id` excluido del DTO |
| Invitaciones EXTERNAL sin validar `owner_id` (SEC-03) | ✅ Cerrado — validación contra org implementada |
| Constraints de integridad DB (SEC-04) | ✅ Aplicadas en producción |
| Swagger público en producción (SEC-06) | ✅ Cerrado — gateado por `!isProduction` |
| `/uploads` público en producción (SEC-07) | ✅ Cerrado — `ServeStaticModule` condicional |
| Dashboard ranking de workers sin filtro de tenant | ✅ Cerrado — `organization_id` añadido al `findMany` |
| Verificación de email duplicado por-tenant en `createUser` | ✅ Cerrado — ahora usa `findUnique` global |
| Invitación a email existente en otra org | ✅ Cerrado — validación global antes de enviar email |

---

## Criterio de cierre

Un ítem puede eliminarse de este documento cuando:

1. La solución fue implementada en código.
2. Fue validada localmente (build limpio, comportamiento correcto).
3. Fue validada en producción si el cambio afecta runtime (auth, storage, DB).
4. `API_CONTRACTS.md` o `ARCHITECTURE.md` fueron actualizados si el cambio afecta comportamiento de producto o API visible.
