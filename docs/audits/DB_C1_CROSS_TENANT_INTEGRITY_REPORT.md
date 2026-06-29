# DB-C1 Cross-Tenant Integrity Report

## 1. Fecha

2026-06-29

## 2. Rama

`fix/db-c1-cross-tenant-integrity`

## 3. Commit base

`bc1df2e` (`main`, incluye PR1 y PR2)

## 4. Commits creados

`fix(db): restore cross-tenant integrity constraints`

## 5. Hallazgo DB-C1

`PRE_PRODUCTION_AUDIT.md` reportó que la base de datos perdió dos foreign keys compuestas que impedían referencias cross-tenant:

- `Asset` con `Owner` de otra organización.
- `Service` con `Asset` de otra organización.

## 6. Relaciones afectadas

| Relación | Tabla hija | Columnas hijas | Tabla padre | Columnas padre | Constraint |
|---|---|---|---|---|---|
| Asset -> Owner | `Asset` | `owner_id`, `organization_id` | `Owner` | `id`, `organization_id` | `Asset_owner_same_organization_fkey` |
| Service -> Asset | `Service` | `asset_id`, `organization_id` | `Asset` | `id`, `organization_id` | `Service_asset_same_organization_fkey` |

## 7. Causa raíz

La migración `20260517000100_phase7_integrity_constraints` agregó correctamente:

- `Owner_id_organization_id_key`
- `Asset_id_organization_id_key`
- `Asset_owner_same_organization_fkey`
- `Service_asset_same_organization_fkey`

La migración posterior `20260517145921_add_show_org_name_to_organization`, que solo debía añadir `Organization.show_org_name`, eliminó ambas FKs compuestas y solo restauró la FK simple `Asset_owner_id_fkey`.

## 8. Migración donde se produjo el problema

Archivo:

`backend/prisma/migrations/20260517145921_add_show_org_name_to_organization/migration.sql`

Contenido relevante:

```sql
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_owner_id_fkey";
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_owner_same_organization_fkey";
ALTER TABLE "Service" DROP CONSTRAINT "Service_asset_same_organization_fkey";

ALTER TABLE "Organization" ADD COLUMN "show_org_name" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Asset" ADD CONSTRAINT "Asset_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "Owner"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
```

`Service_asset_same_organization_fkey` no fue restaurada. `Asset_owner_same_organization_fkey` tampoco.

## 9. Riesgo de seguridad

Sin estas FKs, un bug de aplicación o acceso SQL directo puede persistir datos que mezclan tenants:

- Un asset de `org-a` apuntando a un owner de `org-b`.
- Un service de `org-b` apuntando a un asset de `org-a`.

Esto rompe aislamiento multi-tenant a nivel de motor. La validación TypeScript no es suficiente como autoridad final.

## 10. Consultas de diagnóstico

Asset total:

```sql
SELECT COUNT(*) FROM "Asset";
```

Asset/Owner cross-tenant:

```sql
SELECT a."id" AS asset_id,
       a."organization_id" AS asset_organization_id,
       a."owner_id",
       o."organization_id" AS owner_organization_id
FROM "Asset" a
JOIN "Owner" o ON o."id" = a."owner_id"
WHERE a."organization_id" <> o."organization_id";
```

Asset/Owner orphan:

```sql
SELECT a."id" AS asset_id, a."organization_id", a."owner_id"
FROM "Asset" a
LEFT JOIN "Owner" o ON o."id" = a."owner_id"
WHERE o."id" IS NULL;
```

Service total:

```sql
SELECT COUNT(*) FROM "Service";
```

Service/Asset cross-tenant:

```sql
SELECT s."id" AS service_id,
       s."organization_id" AS service_organization_id,
       s."asset_id",
       a."organization_id" AS asset_organization_id
FROM "Service" s
JOIN "Asset" a ON a."id" = s."asset_id"
WHERE s."organization_id" <> a."organization_id";
```

Service/Asset orphan:

```sql
SELECT s."id" AS service_id, s."organization_id", s."asset_id"
FROM "Service" s
LEFT JOIN "Asset" a ON a."id" = s."asset_id"
WHERE a."id" IS NULL;
```

Duplicados que impedirían parent keys:

```sql
SELECT "id", "organization_id", COUNT(*)
FROM "Owner"
GROUP BY "id", "organization_id"
HAVING COUNT(*) > 1;

SELECT "id", "organization_id", COUNT(*)
FROM "Asset"
GROUP BY "id", "organization_id"
HAVING COUNT(*) > 1;
```

## 11. Resultados de datos existentes

No hay `DATABASE_URL` ni `DIRECT_URL` de una base real en este entorno. Por tanto:

- Datos reales existentes: no verificables localmente.
- IDs reales afectados: no verificables localmente.
- Organizaciones reales involucradas: no verificables localmente.

La migración incluye preflight SQL transaccional que aborta antes de crear constraints si encuentra:

- `Asset` apuntando a `Owner` de otra organización.
- `Service` apuntando a `Asset` de otra organización.
- Orphans en cualquiera de las dos relaciones.
- Duplicados en pares padre requeridos.

Resultado sobre base temporal limpia con datos mínimos:

```text
        metric         | count
-----------------------+-------
 Asset total           |     1
 Asset/Owner invalid   |     0
 Asset/Owner orphan    |     0
 Service total         |     1
 Service/Asset invalid |     0
 Service/Asset orphan  |     0
(6 rows)
```

## 12. Diseño de constraints

Se usa foreign key compuesta:

```text
(Asset.owner_id, Asset.organization_id)
  -> (Owner.id, Owner.organization_id)

(Service.asset_id, Service.organization_id)
  -> (Asset.id, Asset.organization_id)
```

Parent keys:

- `Owner @@unique([id, organization_id])`
- `Asset @@unique([id, organization_id])`

Semántica:

- `ON UPDATE CASCADE`
- `ON DELETE RESTRICT`

No se usa trigger porque PostgreSQL puede expresar esta integridad directamente con FKs compuestas.

## 13. Migración implementada

Nueva migración:

`backend/prisma/migrations/20260629190000_restore_cross_tenant_integrity/migration.sql`

Acciones:

1. Ejecuta preflight con conteos y `RAISE EXCEPTION`.
2. Elimina FKs simples redundantes:
   - `Asset_owner_id_fkey`
   - `Service_asset_id_fkey`
3. Agrega:
   - `Asset_owner_same_organization_fkey`
   - `Service_asset_same_organization_fkey`

No usa `CREATE INDEX CONCURRENTLY`.

## 14. Cambios en schema Prisma

`backend/prisma/schema.prisma` ahora modela:

```prisma
owner Owner @relation(
  fields: [owner_id, organization_id],
  references: [id, organization_id],
  onDelete: Restrict,
  onUpdate: Cascade,
  map: "Asset_owner_same_organization_fkey"
)

asset Asset @relation(
  fields: [asset_id, organization_id],
  references: [id, organization_id],
  onDelete: Restrict,
  onUpdate: Cascade,
  map: "Service_asset_same_organization_fkey"
)
```

`@@unique([id, organization_id])` ya existía en `Owner` y `Asset` y se conserva.

## 15. Cambios en servicios

`backend/src/assets/assets.service.ts`:

- Mantiene validación `owner_id + organization_id` en create/update.
- Cambia error de owner relacionado a mensaje genérico: `Recurso relacionado no encontrado`.

`backend/src/services/services.service.ts`:

- Mantiene validación de `asset_id` scoped por `organization_id` para `ADMIN` y `WORKER`.
- Para `SUPER_ADMIN`, deriva `organization_id` desde el asset, evitando que el frontend dicte el tenant.
- Cambia errores relacionados a mensaje genérico.

## 16. Tests agregados

`backend/src/prisma/db-c1-cross-tenant-integrity.spec.ts`:

- Verifica migración DB-C1.
- Verifica FKs compuestas.
- Verifica `ON UPDATE CASCADE` y `ON DELETE RESTRICT`.
- Verifica preflight SQL.
- Verifica que no se use `CONCURRENTLY`.
- Verifica que Prisma schema referencia las FKs compuestas.

`backend/src/assets/assets.service.spec.ts`:

- Create Asset con owner de otra organización se rechaza.
- Update Asset hacia owner de otra organización se rechaza.
- Update Asset hacia owner de la misma organización funciona.
- Error no filtra tenant ni existencia cross-org.

`backend/src/services/services.service.spec.ts`:

- WORKER no puede crear service con asset de otra organización.
- ADMIN no puede crear service con asset de otra organización.
- SUPER_ADMIN deriva `organization_id` desde el asset.
- Error no filtra tenant ni existencia cross-org.

## 17. Resultados de lint

Comando:

```bash
npm run lint
```

Resultado:

```text
✖ 2324 problems (2064 errors, 260 warnings)
```

El baseline de lint existente sigue fallando ampliamente. No se hizo limpieza general. `npm run lint` usa `--fix`; los cambios automáticos en archivos fuera de DB-C1 fueron revertidos.

Actualización CI lint PR3, 2026-06-29:

- CI reportó regresión: `Actual: 2184 errores, 261 warnings`; `Baseline: 2177 errores, 255 warnings`; delta `+7 errores, +6 warnings`.
- Causa: los tests nuevos de DB-C1 añadieron mocks Prisma/Jest con valores `any`, asserts directos sobre métodos Prisma que activaban `@typescript-eslint/unbound-method`, y verificaciones duplicadas de rechazos que aumentaban hallazgos en líneas nuevas.
- Archivos corregidos:
  - `backend/src/assets/assets.service.spec.ts`
  - `backend/src/services/services.service.spec.ts`
- Corrección aplicada: helpers tipados con modelos Prisma para datos mock, asserts sobre referencias de `spyOn`, inspección tipada de argumentos de mocks y eliminación de verificaciones duplicadas cubiertas por el mensaje genérico exacto.

Resultado de `npm run lint` ejecutado durante la corrección:

```text
✖ 2307 problems (2053 errors, 254 warnings)
```

Medición final sin autofix sobre el working tree corregido:

```text
Final ESLint JSON count: 2173 errors, 255 warnings
```

Conclusión lint: dentro de baseline (`errors <= 2177`, `warnings <= 255`). No se modificó `.github/lint-baseline.json`.

## 18. Resultados de typecheck

Comando:

```bash
npx tsc --noEmit
```

Resultado:

```text
sin output, exit 0
```

Revalidación CI lint PR3:

```text
sin output, exit 0
```

## 19. Resultados de tests

Comando específico:

```bash
npx jest src/prisma/db-c1-cross-tenant-integrity.spec.ts src/assets/assets.service.spec.ts src/services/services.service.spec.ts --no-coverage --runInBand
```

Resultado:

```text
Test Suites: 3 passed, 3 total
Tests:       49 passed, 49 total
Snapshots:   0 total
Time:        5.946 s
```

Comando completo:

```bash
npx jest --no-coverage
```

Resultado final:

```text
Test Suites: 30 passed, 30 total
Tests:       248 passed, 248 total
Snapshots:   0 total
Time:        11.366 s, estimated 18 s
Ran all test suites.
```

## 20. Resultados de build

Comando:

```bash
npm run build
```

Resultado:

```text
> backend@0.0.1 build
> prisma generate && nest build

warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).
Prisma schema loaded from prisma/schema.prisma
✔ Generated Prisma Client (v6.19.3) to ./node_modules/@prisma/client in 421ms
```

Exit 0.

## 21. Resultado de Prisma

`npm ci`:

```text
added 821 packages, and audited 822 packages in 58s
15 vulnerabilities (1 low, 4 moderate, 10 high)
```

`npx prisma format`:

```text
Prisma schema loaded from prisma/schema.prisma
Formatted prisma/schema.prisma in 104ms
```

`npx prisma validate`:

```text
warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).
Prisma schema loaded from prisma/schema.prisma
Error: Prisma schema validation - (get-config wasm)
Error code: P1012
error: Environment variable not found: DIRECT_URL.
  -->  prisma/schema.prisma:4
```

`npx prisma validate` con `DATABASE_URL` y `DIRECT_URL` sintácticamente válidos solo para validación:

```text
warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).
Prisma schema loaded from prisma/schema.prisma
The schema at prisma/schema.prisma is valid 🚀
```

`npx prisma generate`:

```text
warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).
Prisma schema loaded from prisma/schema.prisma
✔ Generated Prisma Client (v6.19.3) to ./node_modules/@prisma/client in 436ms
```

`npx prisma migrate status` sin DB local real:

```text
Error: P1001: Can't reach database server at `localhost:5432`
```

`npx prisma migrate deploy` contra PostgreSQL temporal:

```text
39 migrations found in prisma/migrations
Applying migration `20260629190000_restore_cross_tenant_integrity`
All migrations have been successfully applied.
```

`npx prisma migrate status` contra PostgreSQL temporal:

```text
39 migrations found in prisma/migrations
Database schema is up to date!
```

## 22. Evidencia de bloqueo cross-tenant

Base temporal: PostgreSQL 16 Docker, `localhost:55433`.

Insert válido:

```text
INSERT 0 2
INSERT 0 2
INSERT 0 1
INSERT 0 1
INSERT 0 1
```

Intento directo inválido `Asset(org-a) -> Owner(org-b)`:

```text
ERROR:  insert or update on table "Asset" violates foreign key constraint "Asset_owner_same_organization_fkey"
DETAIL:  Key (owner_id, organization_id)=(owner-b, org-a) is not present in table "Owner".
```

Intento directo inválido `Service(org-b) -> Asset(org-a)`:

```text
ERROR:  insert or update on table "Service" violates foreign key constraint "Service_asset_same_organization_fkey"
DETAIL:  Key (asset_id, organization_id)=(asset-a, org-b) is not present in table "Asset".
```

`ON DELETE RESTRICT` Owner referenciado:

```text
ERROR:  update or delete on table "Owner" violates foreign key constraint "Asset_owner_same_organization_fkey" on table "Asset"
DETAIL:  Key (id, organization_id)=(owner-a, org-a) is still referenced from table "Asset".
```

`ON DELETE RESTRICT` Asset referenciado:

```text
ERROR:  update or delete on table "Asset" violates foreign key constraint "Service_asset_same_organization_fkey" on table "Service"
DETAIL:  Key (id, organization_id)=(asset-a, org-a) is still referenced from table "Service".
```

## 23. Consideraciones de producción

Antes de `prisma migrate deploy` en producción, ejecutar las consultas de diagnóstico de la sección 10 sobre una conexión read-only o copia reciente.

Si hay filas inválidas, no aplicar la migración hasta definir saneamiento explícito. No reasignar tenants de forma arbitraria.

## 24. Orden de despliegue

1. Ejecutar diagnóstico DB-C1 en producción.
2. Si conteos inválidos son 0, desplegar backend con esta migración.
3. Ejecutar `npx prisma migrate deploy`.
4. Verificar constraints en PostgreSQL:

```sql
SELECT conname
FROM pg_constraint
WHERE conname IN (
  'Asset_owner_same_organization_fkey',
  'Service_asset_same_organization_fkey'
);
```

5. Ejecutar smoke test de creación de Asset/Service válido.

## 25. Riesgo de locks

`ALTER TABLE ... ADD CONSTRAINT` toma locks sobre `Asset` y `Service` mientras valida datos existentes. Riesgo esperado: bajo a medio según tamaño de tablas.

No se usa `CREATE INDEX CONCURRENTLY` porque Prisma migrations corren transaccionalmente. Las parent keys compuestas ya existen desde migraciones previas.

## 26. Plan de rollback

Si se requiere rollback:

```sql
ALTER TABLE "Service" DROP CONSTRAINT IF EXISTS "Service_asset_same_organization_fkey";
ALTER TABLE "Asset" DROP CONSTRAINT IF EXISTS "Asset_owner_same_organization_fkey";

ALTER TABLE "Asset"
  ADD CONSTRAINT "Asset_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "Owner"("id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "Service"
  ADD CONSTRAINT "Service_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "Asset"("id")
  ON UPDATE CASCADE ON DELETE RESTRICT;
```

Rollback reduce integridad cross-tenant; solo usar para desbloquear incidente y abrir fix-forward inmediato.

## 27. Limitaciones

- No se pudo inspeccionar una base real porque `DATABASE_URL`/`DIRECT_URL` no están disponibles.
- La evidencia de datos existentes es sobre base temporal limpia, no producción.
- Lint completo sigue fallando por baseline existente; no se amplió el alcance para limpiarlo.
- No se implementa RLS ni DB-H2; quedan fuera de DB-C1.

## 28. Veredicto final

Listo para PR con observación operativa: producción debe ejecutar diagnóstico antes de `migrate deploy`. La migración fallará de forma segura si existen datos cross-tenant u orphans.
