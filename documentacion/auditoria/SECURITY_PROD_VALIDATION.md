# Validación Post-Fix de Seguridad — Recall

**Fecha de validación:** 2026-06-07
**Branch:** main
**Commit de fixes:** `3bcb78c` — fix: close SEC-01..07 multi-tenant security findings
**Último commit:** `c2e6c8a` — fix: use translation key for only-current-device message
**Working tree:** limpio (sin cambios pendientes)

---

## Estado general

| Hallazgo | Descripción original | Estado |
|---|---|---|
| SEC-01 | PATCH /assets/:id aceptaba `any` | ✅ Cerrado |
| SEC-02 | PATCH /services/:id permitía cambiar `asset_id` sin validar tenant | ✅ Cerrado |
| SEC-03 | Invitaciones EXTERNAL no validaban `owner_id` contra organización | ✅ Cerrado |
| SEC-04 | Constraints de DB requieren validación en producción | ⚠️ Requiere verificación en prod |
| SEC-05 | JWT en localStorage | 🔲 Pendiente — fuera del alcance actual |
| SEC-06 | Swagger público en producción | ✅ Cerrado |
| SEC-07 | `/uploads` público montado en producción | ✅ Cerrado |

---

## Verificación por hallazgo

### SEC-01 — PATCH /assets/:id — ✅ Cerrado

**Fix esperado:** Crear `UpdateAssetDto` estricto y reemplazar `any` en el controller/service.

**Verificación:**

```
grep -rn "UpdateAssetDto" backend/src/assets/
→ assets.controller.ts:8:  import { UpdateAssetDto } from './dto/update-asset.dto';
→ assets.controller.ts:87: update(..., @Body() updateAssetDto: UpdateAssetDto, ...)
→ assets.service.ts:7:     import { UpdateAssetDto } from './dto/update-asset.dto';
→ assets.service.ts:389:   async update(id: string, updateDto: UpdateAssetDto, ...)

grep -rn "updateAssetDto: any" backend/src/assets/
→ NOT FOUND
```

**Estado del código:**

- `UpdateAssetDto` existe en `backend/src/assets/dto/update-asset.dto.ts`.
- Campos permitidos: `name`, `description`, `category`, `location`, `serial_number`, `owner_id`.
- Campos bloqueados por `@IsEmpty`: `thumbnail_url`, `company_id`, `customer_id`.
- Campos no declarados (whitelist los elimina): `organization_id`, `organizationId`, `thumbnail_file_id`, `id`, `created_at`, `updated_at` y sus variantes camelCase.
- `ValidationPipe(whitelist: true)` activo globalmente en `main.ts`.
- El service no puede recibir campos sensibles: la segunda barrera `hasLegacyOwnerAliases` bloquea `company_id`/`customer_id` incluso como string vacío.
- `owner_id` se valida contra la organización con `ensureOwnerBelongsToOrg()` antes de persistir.

---

### SEC-02 — PATCH /services/:id — ✅ Cerrado

**Fix esperado:** Remover `asset_id` del DTO de update de services.

**Verificación:**

```
grep -n "PartialType(CreateServiceDto)" backend/src/services/dto/update-service.dto.ts
→ NOT FOUND

grep -n "asset_id" backend/src/services/dto/update-service.dto.ts
→ 28: // asset_id excluido deliberadamente: un servicio no puede reasignarse a otro activo.
```

**Estado del código:**

`UpdateServiceDto` fue reescrito completamente. Ya no extiende `PartialType(CreateServiceDto)`. Define explícitamente solo: `title`, `description`, `is_public`, `status`. Cualquier campo adicional que el cliente envíe (`asset_id`, `assetId`, `organization_id`, `worker_id`, etc.) es eliminado por whitelist antes de llegar al handler. El service hace `...updateServiceDto` sobre datos ya saneados.

---

### SEC-03 — Invitaciones EXTERNAL — ✅ Cerrado

**Fix esperado:** Validar que `owner_id` pertenezca a la misma organización y esté activo.

**Verificación:**

```
grep -n "owner_id\|organization_id" backend/src/invitations/invitations.service.ts
→ 26: if (dto.role === 'EXTERNAL' && !dto.owner_id)   → 400 si falta
→ 35: if (dto.role === 'EXTERNAL' && dto.owner_id)    → valida contra org
→ 37:   where: { id: dto.owner_id, organization_id: organizationId, is_active: true }
→ 40: throw BadRequestException(...)                  → 400 si no pertenece o inactivo
```

**Estado del código:**

La validación cubre todos los escenarios:

| Caso | Resultado |
|---|---|
| EXTERNAL sin `owner_id` | 400 — "owner_id es requerido" |
| EXTERNAL con `owner_id` de otra organización | 400 — "El owner indicado no existe o no pertenece a esta organización" |
| EXTERNAL con `owner_id` de la misma org pero inactivo (`is_active: false`) | 400 — mismo mensaje |
| EXTERNAL con `owner_id` válido, misma org, activo | Continúa normalmente |
| SUPER_ADMIN creando EXTERNAL en org ajena con owner de esa org | `organizationId` se toma de `dto.organization_id`; owner se valida contra ese ID — correcto |

---

### SEC-04 — Constraints de base de datos — ⚠️ Requiere verificación en producción

**Fix esperado:** Confirmar que la migración `20260517000100_phase7_integrity_constraints` esté aplicada en producción.

**Estado del código:** No se requieren cambios de código. Los constraints se gestionan mediante migraciones Prisma.

**Pasos recomendados:**

1. Verificar estado de migraciones en producción:

```bash
# Desde el backend con DATABASE_URL apuntando a producción:
npx prisma migrate status
```

Si aparece alguna migración como `not applied`, ejecutar:

```bash
npx prisma migrate deploy
```

2. Confirmar constraints existentes (verificación SQL opcional, solo si `migrate status` indica inconsistencias):

```sql
SELECT conname, contype, conrelid::regclass AS table_name
FROM pg_constraint
WHERE conname IN (
  'Asset_owner_same_organization_fkey',
  'Service_asset_same_organization_fkey',
  'User_role_owner_consistency_chk',
  'StoredFile_entity_type_chk'
)
ORDER BY conname;
-- Esperado: 4 filas. Si faltan, ejecutar migrate deploy primero.
```

---

### SEC-05 — JWT en localStorage — 🔲 Pendiente

**Descripción:** El token JWT se guarda en `localStorage` y en una cookie accesible por JS. Un XSS exitoso permitiría robo del token hasta su expiración (12h).

**Estado:** Sin cambios. Este hallazgo requiere una decisión de arquitectura (migrar a cookie HttpOnly, Secure, SameSite=Strict) y está fuera del alcance del fix actual. Las sesiones tienen revocación server-side como mitigación parcial.

---

### SEC-06 — Swagger en producción — ✅ Cerrado

**Fix esperado:** No montar `/api` cuando `NODE_ENV === 'production'`.

**Verificación:**

```
grep -n "isProduction\|!isProduction" backend/src/main.ts
→ 54: const isProduction = configService.get<string>('NODE_ENV') === 'production';
→ 106: if (!isProduction) {
→ 115:   SwaggerModule.setup('api', app, document);
→ (cierre de bloque if)
```

**Estado del código:** Swagger solo se registra dentro del bloque `if (!isProduction)`. En producción, la ruta `/api` devuelve 404.

---

### SEC-07 — `/uploads` público en producción — ✅ Cerrado

**Fix esperado:** No montar `ServeStaticModule` cuando `NODE_ENV === 'production'`.

**Verificación:**

```
grep -n "ServeStaticModule" backend/src/app.module.ts
→ 3:  import { ServeStaticModule } from '@nestjs/serve-static';
→ 43: ...(process.env.NODE_ENV !== 'production'
→       ? [ServeStaticModule.forRoot({ rootPath: ..., serveRoot: '/uploads' })]
→       : []),
```

**Estado del código:** El módulo se incluye condicionalmente. En producción (`NODE_ENV=production`), el array es vacío y `/uploads/*` devuelve 404. Además, `requireProductionEnv()` en `main.ts` fuerza `STORAGE_TYPE=supabase` en producción, por lo que la aplicación no levanta si se intenta usar storage local.

---

## Pruebas de regresión recomendadas antes de desplegar

```bash
# 1. SEC-01: organization_id ignorado en update de asset
curl -s -X PATCH http://localhost:3000/assets/<ID> \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","organization_id":"<ORG_AJENA>"}' | jq .organization_id
# Esperado: orgId original sin cambiar

# 2. SEC-02: asset_id ignorado en update de service
curl -s -X PATCH http://localhost:3000/services/<ID> \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","asset_id":"<ASSET_AJENO>"}' | jq .asset_id
# Esperado: asset_id original sin cambiar

# 3. SEC-03: owner de otra org rechazado en invitación EXTERNAL
curl -s -X POST http://localhost:3000/invitations \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"email":"x@test.com","role":"EXTERNAL","owner_id":"<OWNER_ORG_B>"}' | jq .message
# Esperado: "El owner indicado no existe o no pertenece a esta organización"

# 4. SEC-06: Swagger ausente en producción
NODE_ENV=production curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api
# Esperado: 404

# 5. SEC-07: /uploads ausente en producción
NODE_ENV=production curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/uploads/test.jpg
# Esperado: 404

# 6. Edición normal de service no se rompe
curl -s -X PATCH http://localhost:3000/services/<ID> \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Nuevo título","is_public":true}' | jq '{title,is_public}'
# Esperado: title e is_public actualizados
```

---

## Riesgos pendientes tras este ciclo de fixes

| Riesgo | Prioridad | Notas |
|---|---|---|
| JWT en localStorage (SEC-05) | Alta | Migrar a cookie HttpOnly antes de producción con datos reales |
| Constraints en DB productiva (SEC-04) | Alta | Ejecutar `npx prisma migrate status` antes del primer deploy |
| `resolveFileUrl` sin contexto de tenant | Baja | **Análisis completo (2026-06-07):** no es vulnerabilidad activa. Fix mínimo aplicado: `dashboard.service.ts` → `getRankingDetails` ahora filtra users por `organization_id`. Deuda pendiente: implementar `resolveFileUrlForOrg(storedFileId, organizationId)` en `StoredFilesService` como defensa en profundidad antes de escalar a múltiples tenants activos. |
| Email único global vs por tenant | Media | Decisión de producto pendiente |
| `worker_restricted_access` en settings sin implementación backend | Baja | No activar en UI hasta implementar en queries |
| `forbidNonWhitelisted` no activo globalmente | Baja | Mejora de diagnóstico, no de seguridad; evaluar por endpoint JSON puro |
