# Validación de Seguridad en Producción

**Commit de referencia:** `c2e6c8a`
**Propósito:** Verificar en producción que los fixes de seguridad (constraints de integridad fase 7 + protecciones de API) funcionan correctamente.
**Restricciones:** Solo lectura y observación. No modifica código, no ejecuta migraciones, no crea datos permanentes.

---

## Variables de entorno

Configurar antes de ejecutar cualquier prueba:

```bash
export API_URL="https://TU_BACKEND_PRODUCCION"
export TOKEN_ADMIN_ORG_A="..."
export ORG_ID_A="..."
export ORG_ID_B="..."
export ASSET_ID_ORG_A="..."
export ASSET_ID_ORG_B="..."
export SERVICE_ID_ORG_A="..."
export OWNER_ID_ORG_B="..."
```

Verificar que todas estén completas antes de continuar:

```bash
for var in API_URL TOKEN_ADMIN_ORG_A ORG_ID_A ORG_ID_B ASSET_ID_ORG_A ASSET_ID_ORG_B SERVICE_ID_ORG_A OWNER_ID_ORG_B; do
  val="${!var}"
  if [ -z "$val" ] || [ "$val" = "..." ]; then
    echo "FALTA: $var"
  else
    echo "OK:    $var = ${val:0:20}..."
  fi
done
```

---

## Datos de prueba necesarios

Las pruebas de las secciones 2, 3 y 5 requieren entidades reales en dos organizaciones distintas. Las secciones 1 y 4 no requieren datos previos.

### Entidades a crear

| # | Entidad | Descripción | Variable a obtener |
|---|---|---|---|
| 1 | **Organización A** | Organización de prueba A | `ORG_ID_A` |
| 2 | **Admin A** | Usuario con `role: ADMIN` en Org A | `TOKEN_ADMIN_ORG_A` (JWT del login) |
| 3 | **Asset A** | Activo dentro de Org A (requiere un Owner A en la misma org) | `ASSET_ID_ORG_A` |
| 4 | **Service A** | Servicio registrado sobre Asset A | `SERVICE_ID_ORG_A` |
| 5 | **Organización B** | Organización de prueba B, separada | `ORG_ID_B` |
| 6 | **Owner B** | Propietario dentro de Org B | `OWNER_ID_ORG_B` |
| 7 | **Asset B** | Activo dentro de Org B (requiere Owner B) | `ASSET_ID_ORG_B` |

### Cómo obtener los UUIDs en Supabase SQL Editor

```sql
-- Organizaciones
SELECT id, name FROM "Organization" WHERE name IN ('Test Org A', 'Test Org B');

-- Assets de cada org
SELECT id, name, organization_id FROM "Asset"
WHERE organization_id IN ('<ORG_ID_A>', '<ORG_ID_B>');

-- Service de Org A
SELECT id, title FROM "Service"
WHERE organization_id = '<ORG_ID_A>' LIMIT 1;

-- Owner de Org B
SELECT id, name FROM "Owner"
WHERE organization_id = '<ORG_ID_B>' LIMIT 1;
```

`TOKEN_ADMIN_ORG_A`: hacer `POST /auth/login` con las credenciales de Admin A y copiar el JWT.

---

## Sección 1 — Superficie de exposición

*No requiere datos de prueba ni token.*

---

### Prueba 1.1 — Swagger no debe ser accesible en producción

**Estado del fix:** `main.ts` línea 106 — Swagger ahora está dentro de `if (!isProduction) { ... }`. En producción la ruta `/api` no está registrada.

**Comando:**

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" "$API_URL/api"
```

**Detección específica:**

```bash
curl -s "$API_URL/api" | grep -q "Swagger UI" \
  && echo "FALLO: Swagger accesible en produccion" \
  || echo "OK: Swagger no detectado"
```

**Resultado esperado:** `HTTP 404` y el segundo comando imprime `OK`.

**Cómo interpretar resultado correcto:**
- `HTTP 404` → la ruta no está montada en producción. Fix activo. Correcto.

**Fallo crítico:** El segundo comando imprime `FALLO`. El bloque `if (!isProduction)` no está activo, ya sea porque `NODE_ENV` no está seteado como `production` en el servidor o porque el build no refleja el commit actual.

**Qué hacer si falla:**
1. Verificar que la variable de entorno del servidor tenga `NODE_ENV=production`.
2. Confirmar que el build desplegado corresponde al commit `c2e6c8a` o posterior.

---

### Prueba 1.2 — `/uploads` no debe ser accesible en producción

**Estado del fix:** `app.module.ts` líneas 42-47 — `ServeStaticModule` ahora está dentro de `...(process.env.NODE_ENV !== 'production' ? [...] : [])`. En producción la ruta `/uploads` no está montada.

**Comandos:**

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" "$API_URL/uploads/test.jpg"
curl -s -o /dev/null -w "HTTP %{http_code}\n" "$API_URL/uploads/"
```

**Resultado esperado:** Ambos devuelven `HTTP 404`.

**Cómo interpretar resultado correcto:**
- `HTTP 404` en ambos → la ruta no está montada en producción. Fix activo. Correcto.

**Fallo crítico:** Cualquier `HTTP 200`. El módulo de archivos estáticos está activo en producción, exponiendo el directorio `uploads/` sin autenticación.

**Qué hacer si falla:**
1. Verificar `NODE_ENV=production` en el servidor.
2. Confirmar que el build desplegado corresponde al commit `c2e6c8a` o posterior.

---

## Sección 2 — Inyección de campos prohibidos en PATCH

*Requiere datos de Org A y Org B.*

---

### Prueba 2.1 — `PATCH /assets/:id` no debe aceptar `organization_id` ni `organizationId`

**Estado del fix:** El controlador ahora usa `@Body() updateAssetDto: UpdateAssetDto` (tipado). `organization_id` no está declarado en `UpdateAssetDto`, por lo que `ValidationPipe(whitelist: true)` lo elimina antes de que llegue al servicio. Lo mismo aplica a `organizationId` en camelCase. Los campos `thumbnail_url`, `company_id` y `customer_id` devuelven error `400` por `@IsEmpty()`.

**Comando — snake_case:**

```bash
curl -s -X PATCH "$API_URL/assets/$ASSET_ID_ORG_A" \
  -H "Authorization: Bearer $TOKEN_ADMIN_ORG_A" \
  -H "Content-Type: application/json" \
  -d "{\"organization_id\": \"$ORG_ID_B\"}" \
  | jq '{http_status: .statusCode, organization_id_en_respuesta: .organization_id}'
```

**Comando — camelCase:**

```bash
curl -s -X PATCH "$API_URL/assets/$ASSET_ID_ORG_A" \
  -H "Authorization: Bearer $TOKEN_ADMIN_ORG_A" \
  -H "Content-Type: application/json" \
  -d "{\"organizationId\": \"$ORG_ID_B\"}" \
  | jq '{http_status: .statusCode, organization_id_en_respuesta: .organization_id}'
```

**Resultado esperado en ambos casos:** El campo es ignorado silenciosamente. La respuesta devuelve `HTTP 200` con el asset intacto y `organization_id` igual a `$ORG_ID_A`.

**Verificación adicional en Supabase SQL Editor:**

```sql
SELECT id, organization_id FROM "Asset" WHERE id = '<ASSET_ID_ORG_A>';
-- organization_id debe seguir siendo ORG_ID_A
```

**Cómo interpretar resultado correcto:**
- `organization_id` en la respuesta sigue siendo `$ORG_ID_A` → `whitelist: true` descartó el campo. Fix activo. Correcto.

**Fallo crítico:** `organization_id` en la respuesta cambió a `$ORG_ID_B`. El DTO tipado no está siendo utilizado o `whitelist` está desactivado. El asset fue movido a otra organización.

**Qué hacer si falla:**
1. Verificar que el build desplegado refleje el commit `c2e6c8a`.
2. Confirmar que `ValidationPipe` en `main.ts` tiene `whitelist: true`.
3. Verificar que `assets.controller.ts` usa `@Body() updateAssetDto: UpdateAssetDto` y no `any`.

---

### Prueba 2.2 — `PATCH /services/:id` no debe aceptar `asset_id` ni `assetId`

**Estado del fix:** `UpdateServiceDto` es ahora una clase independiente (no extiende `CreateServiceDto`). `asset_id` está explícitamente excluido con el comentario `// asset_id excluido deliberadamente`. `ValidationPipe(whitelist: true)` descarta cualquier campo no declarado, incluyendo `asset_id` y `assetId`.

**Comando — snake_case:**

```bash
curl -s -X PATCH "$API_URL/services/$SERVICE_ID_ORG_A" \
  -H "Authorization: Bearer $TOKEN_ADMIN_ORG_A" \
  -H "Content-Type: application/json" \
  -d "{\"asset_id\": \"$ASSET_ID_ORG_B\"}" \
  | jq '{http_status: .statusCode, asset_id_en_respuesta: .asset_id}'
```

**Comando — camelCase:**

```bash
curl -s -X PATCH "$API_URL/services/$SERVICE_ID_ORG_A" \
  -H "Authorization: Bearer $TOKEN_ADMIN_ORG_A" \
  -H "Content-Type: application/json" \
  -d "{\"assetId\": \"$ASSET_ID_ORG_B\"}" \
  | jq '{http_status: .statusCode, asset_id_en_respuesta: .asset_id}'
```

**Resultado esperado en ambos casos:** `HTTP 200` con el servicio intacto. `asset_id` en la respuesta sigue siendo el asset original de Org A.

**Verificación adicional en Supabase SQL Editor:**

```sql
SELECT id, asset_id, organization_id FROM "Service" WHERE id = '<SERVICE_ID_ORG_A>';
-- asset_id debe seguir apuntando al asset de Org A
```

**Cómo interpretar resultado correcto:**
- `asset_id` en la respuesta no cambió → `whitelist: true` descartó ambos campos. Fix activo. Correcto.

**Fallo crítico:** `asset_id` en la respuesta cambió a `$ASSET_ID_ORG_B`. El DTO `UpdateServiceDto` volvió a heredar `CreateServiceDto` o `whitelist` está desactivado.

**Qué hacer si falla:**
1. Verificar que `update-service.dto.ts` no tenga `PartialType(CreateServiceDto)` ni declare `asset_id`.
2. Confirmar que el build desplegado es `c2e6c8a` o posterior.

---

## Sección 3 — Validaciones de negocio en invitaciones

*Requiere `TOKEN_ADMIN_ORG_A` y `OWNER_ID_ORG_B`.*

---

### Prueba 3.1 — `POST /invitations` con `role: EXTERNAL` y `owner_id` de otra org debe devolver 400

**Estado del fix:** `invitations.service.ts` líneas 35-43 — ahora valida que el `owner_id` exista y pertenezca a `organizationId` antes de crear la invitación. Devuelve `400` con mensaje "El owner indicado no existe o no pertenece a esta organización".

**Comando:**

```bash
curl -s -X POST "$API_URL/invitations" \
  -H "Authorization: Bearer $TOKEN_ADMIN_ORG_A" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"sec-test-$(date +%s)@prueba-invalida.local\",
    \"role\": \"EXTERNAL\",
    \"owner_id\": \"$OWNER_ID_ORG_B\"
  }" \
  | jq '{http_status: .statusCode, message: .message}'
```

**Resultado esperado:**

```json
{ "http_status": 400, "message": "El owner indicado no existe o no pertenece a esta organización" }
```

**Cómo interpretar resultado correcto:**
- `statusCode: 400` con ese mensaje exacto → la validación cross-tenant de owner está activa. Fix activo. Correcto.

**Fallo crítico:** `statusCode: 201` o respuesta con `id` de invitación. La validación no está activa: se creó una invitación que vincula a un usuario de Org A con un owner de Org B.

**Si por error se creó la invitación, limpiarla:**

```sql
-- Verificar primero
SELECT id, email, role, owner_id, organization_id
FROM "Invitation"
WHERE email LIKE 'sec-test-%' AND is_used = false
ORDER BY created_at DESC LIMIT 3;

-- Borrar solo si confirmas que es la de prueba
DELETE FROM "Invitation"
WHERE email LIKE 'sec-test-%' AND is_used = false;
```

**Qué hacer si falla:**
1. Verificar que el build desplegado sea `c2e6c8a` o posterior.
2. Confirmar que `invitations.service.ts` tiene el bloque de validación de owner (líneas 35-43).

---

### Prueba 3.2 — `POST /invitations` con `role: EXTERNAL` sin `owner_id` debe devolver 400

**Estado del fix:** Validación existente desde antes del commit de referencia, en `invitations.service.ts` línea 26.

**Comando:**

```bash
curl -s -X POST "$API_URL/invitations" \
  -H "Authorization: Bearer $TOKEN_ADMIN_ORG_A" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"sec-test-noowner@prueba-invalida.local\", \"role\": \"EXTERNAL\"}" \
  | jq '{http_status: .statusCode, message: .message}'
```

**Resultado esperado:**

```json
{ "http_status": 400, "message": "owner_id es requerido para invitaciones con rol EXTERNAL" }
```

**Fallo crítico:** `statusCode: 201`. Se creó una invitación EXTERNAL sin owner. Viola el constraint `User_role_owner_consistency_chk` al completar el registro.

---

## Sección 4 — Integridad de la base de datos

*No requiere datos de prueba. Ejecutar en Supabase Dashboard → SQL Editor.*

---

### Paso previo — Verificar estado de migraciones

Antes de las consultas SQL, verificar el estado de migraciones desde el entorno de backend:

```bash
# Desde el directorio backend con la DATABASE_URL de producción configurada
npx prisma migrate status
```

**Resultado esperado:** Todas las migraciones en estado `Applied`. Si alguna aparece como `Pending`, ejecutar:

```bash
npx prisma migrate deploy
```

> `prisma migrate deploy` aplica solo migraciones pendientes sin modificar el esquema existente. Es seguro en producción.

---

### Consulta 4.1 — Verificar que los 4 constraints de fase 7 existen

```sql
SELECT
  conname                          AS constraint_name,
  CASE contype
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'c' THEN 'CHECK'
    ELSE contype::text
  END                              AS tipo,
  relname                          AS tabla
FROM pg_constraint
JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
WHERE conname IN (
  'Asset_owner_same_organization_fkey',
  'Service_asset_same_organization_fkey',
  'User_role_owner_consistency_chk',
  'StoredFile_entity_type_chk'
)
ORDER BY conname;
```

**Resultado esperado — exactamente 4 filas:**

| constraint_name | tipo | tabla |
|---|---|---|
| Asset_owner_same_organization_fkey | FOREIGN KEY | Asset |
| Service_asset_same_organization_fkey | FOREIGN KEY | Service |
| StoredFile_entity_type_chk | CHECK | StoredFile |
| User_role_owner_consistency_chk | CHECK | User |

**Cómo interpretar resultado correcto:** 4 filas presentes → migración `20260517000100_phase7_integrity_constraints` aplicada. La capa de DB tiene protección activa.

**Fallo crítico:** Menos de 4 filas. La protección a nivel de persistencia no está activa. Ejecutar `npx prisma migrate status` y luego `npx prisma migrate deploy` si hay migraciones pendientes.

---

### Consulta 4.2 — Detectar datos cross-tenant existentes

Verificar que no haya violaciones de aislamiento en datos históricos:

```sql
-- Assets cuyo owner pertenece a otra organización
SELECT a.id AS asset_id, a.organization_id AS asset_org,
       a.owner_id, o.organization_id AS owner_org
FROM "Asset" a
JOIN "Owner" o ON o.id = a.owner_id
WHERE a.organization_id <> o.organization_id;
```

```sql
-- Servicios cuyo asset pertenece a otra organización
SELECT s.id AS service_id, s.organization_id AS service_org,
       s.asset_id, a.organization_id AS asset_org
FROM "Service" s
JOIN "Asset" a ON a.id = s.asset_id
WHERE s.organization_id <> a.organization_id;
```

```sql
-- Usuarios EXTERNAL sin owner_id
SELECT id, email, role, owner_id, organization_id
FROM "User"
WHERE role = 'EXTERNAL' AND owner_id IS NULL;
```

```sql
-- Usuarios no-EXTERNAL con owner_id
SELECT id, email, role, owner_id, organization_id
FROM "User"
WHERE role IN ('SUPER_ADMIN', 'ADMIN', 'WORKER') AND owner_id IS NOT NULL;
```

```sql
-- StoredFiles con entity_type fuera del conjunto permitido
SELECT id, entity_type, kind, organization_id
FROM "StoredFile"
WHERE entity_type NOT IN ('ORGANIZATION', 'OWNER', 'USER', 'ASSET', 'SERVICE');
```

**Resultado esperado:** Las 5 consultas devuelven 0 filas.

**Fallo crítico:** Filas en las primeras dos consultas → datos cross-tenant en producción. Investigar caso por caso el origen y corregirlos manualmente.

---

## Sección 5 — Acceso cross-tenant a activos

*Requiere `TOKEN_ADMIN_ORG_A`, `ASSET_ID_ORG_B` y `ORG_ID_B`.*

---

### Prueba 5.1 — Admin de Org A no debe poder editar un Asset de Org B

**Contexto técnico:** `assets.service.ts` verifica `asset.organization_id !== orgId` antes del update y lanza `ForbiddenException`.

**Comando:**

```bash
curl -s -X PATCH "$API_URL/assets/$ASSET_ID_ORG_B" \
  -H "Authorization: Bearer $TOKEN_ADMIN_ORG_A" \
  -H "Content-Type: application/json" \
  -d '{"name": "intento-cross-tenant-prueba"}' \
  | jq '{http_status: .statusCode, message: .message}'
```

**Resultado esperado:**

```json
{ "http_status": 403, "message": "No tienes permiso para editar este activo" }
```

**Fallo crítico:** `HTTP 200` con el asset actualizado. Un admin puede editar activos de otras organizaciones.

---

### Prueba 5.2 — Admin de Org A no debe poder leer servicios de Org B

**Contexto técnico:** El listado de servicios aplica `where: { organization_id: user.orgId }` para roles no SUPER_ADMIN, ignorando cualquier parámetro de query.

**Comando:**

```bash
curl -s "$API_URL/services?organization_id=$ORG_ID_B" \
  -H "Authorization: Bearer $TOKEN_ADMIN_ORG_A" \
  | jq '{
      total: (.meta.total // (.data | length) // 0),
      primera_org: ((.data // .)[0].organization_id // "sin_resultados")
    }'
```

**Resultado esperado:** `primera_org` igual a `$ORG_ID_A` o `"sin_resultados"`. Nunca `$ORG_ID_B`.

**Fallo crítico:** `primera_org` igual a `$ORG_ID_B`. El parámetro de query puede forzar lectura de datos de otra organización.

---

## Resumen de resultados

| # | Prueba | Fix aplicado | Resultado obtenido | Estado |
|---|---|---|---|---|
| 1.1 | Swagger no accesible en `/api` | `if (!isProduction)` | HTTP _____ | ✅ / ❌ |
| 1.2 | `/uploads/test.jpg` devuelve 404 | `ServeStaticModule` condicional | HTTP _____ | ✅ / ❌ |
| 2.1a | PATCH asset `organization_id` ignorado | `UpdateAssetDto` + `whitelist` | org sin cambio | ✅ / ❌ |
| 2.1b | PATCH asset `organizationId` ignorado | `UpdateAssetDto` + `whitelist` | org sin cambio | �� / ❌ |
| 2.2a | PATCH service `asset_id` ignorado | `UpdateServiceDto` independiente | asset sin cambio | ��� / ❌ |
| 2.2b | PATCH service `assetId` ignorado | `UpdateServiceDto` independiente | asset sin cambio | ✅ / ❌ |
| 3.1 | POST invitations EXTERNAL + owner ajeno → 400 | Validación owner en invitations | HTTP 400 | ✅ / ❌ |
| 3.2 | POST invitations EXTERNAL sin owner → 400 | Validación preexistente | HTTP 400 | ✅ / ❌ |
| 4.0 | Estado de migraciones | `prisma migrate status` | _____ pendientes | ✅ / ❌ |
| 4.1 | 4 constraints fase 7 presentes | Migración phase7_integrity | _____ de 4 filas | �� / ❌ |
| 4.2a | 0 assets con owner de otra org | Constraint FK | _____ filas | ✅ / ❌ |
| 4.2b | 0 servicios con asset de otra org | Constraint FK | _____ filas | ✅ / ❌ |
| 4.2c | 0 usuarios EXTERNAL sin owner_id | Constraint CHECK | _____ filas | ✅ / ❌ |
| 4.2d | 0 StoredFiles con entity_type inválido | Constraint CHECK | _____ filas | �� / ❌ |
| 5.1 | Admin Org A → 403 al editar Asset de Org B | Guard orgId en servicio | HTTP 403 | ✅ / ❌ |
| 5.2 | Admin Org A no ve servicios de Org B | Filtro orgId en listado | primera_org ≠ ORG_ID_B | ✅ / ❌ |
