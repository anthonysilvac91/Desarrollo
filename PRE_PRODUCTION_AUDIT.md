# PRE_PRODUCTION_AUDIT — Fentri SaaS B2B
**Fecha:** 2026-06-28  
**Auditor:** Claude Code (Senior Staff Engineer — Seguridad SaaS B2B)  
**Alcance:** Repositorio completo (backend NestJS, frontend Next.js, Prisma/PostgreSQL, Supabase, Railway, Vercel)  
**Objetivo:** Identificar riesgos que impidan incorporar el primer cliente real

---

## Resumen ejecutivo

**Veredicto: NO LISTO**

### Cinco riesgos principales

1. **Middleware de Next.js es código muerto** — el archivo `proxy.ts` nunca es invocado por el framework; ninguna ruta del frontend tiene protección server-side real.
2. **Bypass completo de 2FA** — el token temporal emitido al iniciar login con 2FA activo es aceptado como token de sesión completa por cualquier endpoint protegido.
3. **Archivos reales de clientes comprometidos en el historial de git** — imágenes de activos, servicios, logos y avatares de al menos 3 organizaciones están rastreadas permanentemente.
4. **FK de aislamiento cross-tenant eliminada y no restaurada** — la restricción que garantiza que un `Asset` y su `Owner` pertenecen a la misma organización fue eliminada en migración y nunca se restableció; el motor de base de datos no puede impedir mezclas de tenant a nivel de datos.
5. **Secreto TOTP almacenado en texto plano en base de datos** — cualquier volcado de DB expone inmediatamente todos los seeds TOTP, eliminando el segundo factor para todos los usuarios.

### Nivel general de riesgo: **CRÍTICO**

Existen 8 hallazgos de severidad CRÍTICA y 21 de severidad ALTA. El sistema no debe recibir datos reales de clientes hasta que los bloqueantes estén resueltos.

---

## Hallazgos bloqueantes

### AUTH-C1 — Bypass completo de autenticación de dos factores
- **Severidad:** CRÍTICA
- **Archivo y líneas:** `backend/src/auth/auth.service.ts:324–328`, `backend/src/auth/jwt.strategy.ts:50–122`
- **Descripción:** `signTwoFactorLoginToken()` firma un JWT con `{ sub: userId, purpose: '2fa_login' }` usando el mismo `JWT_SECRET` y el mismo `JwtService` que los tokens de sesión completa. El método `validate()` en `jwt.strategy.ts` nunca comprueba `payload.purpose`. Los tokens temporales de 2FA no tienen `sid`, por lo que la validación de sesión también se omite (línea 66: `if (payload.sid) { ... }`).
- **Impacto:** Un atacante que conozca la contraseña de una víctima obtiene acceso completo a la API sin completar el segundo factor, durante 5 minutos.
- **Escenario de explotación:** `POST /auth/login` → recibe `{ requires_2fa: true, temporary_token: "eyJ..." }` → usa ese token como `Bearer` en cualquier endpoint (ej. `GET /auth/me`, `PATCH /users/:id/role`) → acceso completo concedido.
- **Evidencia:** `jwt.strategy.ts` línea 66: el bloque de validación de sesión solo ejecuta si `payload.sid` existe; los tokens temporales carecen de ese campo.
- **Corrección:** En `jwt.strategy.ts`, rechazar cualquier token con `payload.purpose` definido: `if (payload.purpose) throw new UnauthorizedException()`.
- **Prueba a agregar:** Test E2E: verificar que un `temporary_token` de 2FA devuelve 401 al usarse como Bearer en `GET /auth/me`.

---

### AUTH-C2 — TOTP reutilizable: no hay tracking de código usado
- **Severidad:** CRÍTICA
- **Archivo y líneas:** `backend/src/auth/auth.service.ts:478–484`, `backend/src/auth/totp.util.ts:28–46`
- **Descripción:** `verifyTotpCode()` acepta códigos con `window=1` (ventana de 90 segundos). No existe ningún mecanismo para marcar un código TOTP ya usado. Un código válido puede reutilizarse ilimitadamente dentro de la ventana.
- **Impacto:** Un atacante que observe el código TOTP de la víctima (phishing, shoulder-surfing) puede completar una sesión adicional con el mismo código.
- **Escenario:** Víctima usa código 123456 a T=0. Atacante lo reutiliza a T=45s en `POST /auth/2fa/login`. Mismo resultado: sesión válida.
- **Corrección:** Persistir `two_factor_last_counter` en el modelo `User`; rechazar cualquier código cuyo counter no sea estrictamente mayor al último registrado (RFC 6238).
- **Prueba:** Test unitario: el mismo código TOTP falla al ser enviado dos veces consecutivas.

---

### AUTH-C3 — Tokens de alto valor almacenados en texto plano en DB
- **Severidad:** CRÍTICA
- **Archivo y líneas:** `backend/src/auth/auth.service.ts:815–821, 1019–1025, 1173–1180`, `backend/src/invitations/invitations.service.ts:105–106`
- **Descripción:** Los tokens de reset de contraseña (hex 64 chars, TTL 15min), tokens de invitación (hex 64 chars, TTL 7 días) y códigos de 2FA por email (6 dígitos) se persisten como texto plano en las tablas `EmailToken` e `Invitation`.
- **Impacto:** Un volcado de DB, SQL injection o backup expuesto entrega inmediatamente todos los tokens activos sin necesidad de crackeo. Los tokens de invitación (7 días) son especialmente peligrosos.
- **Escenario:** `SELECT token FROM "EmailToken" WHERE type='PASSWORD_RESET' AND used_at IS NULL` → toma de cuenta completa.
- **Corrección:** Almacenar `SHA-256(token)`. En verificación: hashear el token entrante y comparar contra el hash almacenado.
- **Prueba:** Test de integración: confirmar que la columna `token` en DB no coincide con el token enviado al usuario.

---

### AUTH-C4 — Secreto TOTP transmitido en claro dentro del JWT de setup
- **Severidad:** CRÍTICA
- **Archivo y líneas:** `backend/src/auth/auth.service.ts:331–335`
- **Descripción:** El método `signTwoFactorSetupToken()` incluye el secreto TOTP base32 dentro del payload del JWT: `{ sub: userId, purpose: '2fa_setup', secret }`. Los JWTs son base64url sin cifrado. El payload es trivialmente decodificable.
- **Impacto:** Cualquier sistema de logging (Datadog, CloudWatch, Railway logs) que capture respuestas o cuerpos de petición durante el setup de 2FA almacena el secreto TOTP permanentemente, permitiendo generar códigos válidos de forma indefinida.
- **Corrección:** Almacenar el secreto TOTP pendiente en DB (`PendingTotpSetup` con TTL). El `setup_token` solo debe contener `{ sub, purpose: '2fa_setup' }`.
- **Prueba:** Verificar que el endpoint de setup no devuelve el secreto en ningún campo del response ni en el JWT.

---

### FE-C1 — Middleware de Next.js es código muerto: cero protección server-side
- **Severidad:** CRÍTICA
- **Archivo y líneas:** `frontend/src/proxy.ts` (archivo completo)
- **Descripción:** Next.js solo ejecuta middleware automáticamente si el archivo se llama `middleware.ts` (o `middleware.js`) en la raíz del proyecto o en `src/`. El archivo existente se llama `proxy.ts` y exporta una función llamada `proxy` (no `default`). Next.js nunca lo invoca. No existe `middleware.ts` en ningún lugar del proyecto.
- **Impacto:** Todas las rutas protegidas (`/dashboard`, `/assets`, `/users`, `/settings`, `/organizations`, `/owners`, `/trash`) tienen cero protección de autenticación a nivel de servidor HTTP. Cualquier herramienta que deshabilite JavaScript accede al HTML de cada ruta privada sin autenticación.
- **Escenario:** `curl https://app.fentri.com/dashboard` → respuesta 200 con el shell de la aplicación sin redirección a login.
- **Corrección:** Renombrar `proxy.ts` → `middleware.ts` y cambiar la función exportada a `export default function middleware(...)`. Agregar `/owners/:path*` y `/trash/:path*` al matcher.
- **Prueba:** Playwright E2E: acceder a `/dashboard` sin cookie de sesión → esperar redirección 307 a `/login`.

---

### SEC-C1 — Archivos reales de clientes comprometidos en historial de git
- **Severidad:** CRÍTICA
- **Archivo y líneas:** `backend/uploads/` (directorio completo, 35+ archivos binarios rastreados)
- **Descripción:** El `.gitignore` lista `backend/uploads/` pero la regla se agregó después de que los archivos ya habían sido commiteados. Git sigue rastreándolos. Los archivos incluyen logos de organizaciones, imágenes de activos, avatares de usuarios y adjuntos de servicios de al menos 3 organizaciones (UUIDs `1ea71758-…`, `7a93537b-…`, `c4f78a63-…`). Adicionalmente, 4 archivos en la raíz de `uploads/` usan el formato Multer legacy y no están registrados en `StoredFile`.
- **Impacto:** Todo contribuidor con acceso al repo puede leer archivos privados de clientes. El historial de git es permanente sin un rewrite completo.
- **Escenario:** `git clone <repo>` → acceso inmediato a todas las imágenes de cliente sin autenticación.
- **Corrección:** (1) `git rm --cached -r backend/uploads/` para dejar de rastrear; (2) `git filter-repo --invert-paths --path backend/uploads/` para purgar el historial; (3) force-push a todos los remotes; (4) Pre-commit hook que rechace commits con archivos en `uploads/`.
- **Prueba:** Script CI que verifique que `git ls-files backend/uploads/` devuelve vacío.

---

### DB-C1 — FK de aislamiento cross-tenant eliminada y no restaurada
- **Severidad:** CRÍTICA
- **Archivo y líneas:** `backend/prisma/migrations/20260517145921_add_show_org_name_to_organization/migration.sql:2–8`
- **Descripción:** La migración `20260517000100` añadió correctamente dos FKs compuestas que garantizan que un Asset y su Owner pertenecen a la misma organización (`Asset_owner_same_organization_fkey`) y que un Service y su Asset pertenecen a la misma organización (`Service_asset_same_organization_fkey`). La migración `20260517145921` (que solo debía añadir una columna booleana) eliminó ambas restricciones y nunca las restauró. Solo se re-añadió la FK simple `Asset_owner_id_fkey`.
- **Impacto:** La base de datos acepta silenciosamente que un Asset tenga un Owner de otra organización, o que un Service tenga un Asset de otra organización. El aislamiento multi-tenant no tiene garantía a nivel de motor de BD.
- **Escenario:** Un bug de aplicación, consulta mal formada o acceso directo a BD puede crear relaciones cross-tenant que el sistema no detectará.
- **Corrección:** Nueva migración que restaure ambas restricciones:
  ```sql
  ALTER TABLE "Asset" ADD CONSTRAINT "Asset_owner_same_organization_fkey"
    FOREIGN KEY ("owner_id","organization_id") REFERENCES "Owner"("id","organization_id")
    ON UPDATE CASCADE ON DELETE RESTRICT;
  ALTER TABLE "Service" ADD CONSTRAINT "Service_asset_same_organization_fkey"
    FOREIGN KEY ("asset_id","organization_id") REFERENCES "Asset"("id","organization_id")
    ON UPDATE CASCADE ON DELETE RESTRICT;
  ```
- **Prueba:** Test de integridad: intentar `INSERT INTO "Asset" (owner_id, organization_id, ...) VALUES (<owner-de-org-B>, <org-A>)` debe fallar con FK violation.

---

### DB-C2 — Secreto TOTP almacenado en texto plano en base de datos
- **Severidad:** CRÍTICA
- **Archivo y líneas:** `backend/prisma/schema.prisma:186`, `backend/src/auth/auth.service.ts:950–951`
- **Descripción:** `User.two_factor_secret String?` se persiste como seed TOTP base32 sin ningún cifrado. Por contraste, `AiProviderSetting.encrypted_api_key` usa correctamente AES-256-GCM. El campo se lee directamente: `verifyTotpCode(user.two_factor_secret, code)`.
- **Impacto:** Un volcado de BD, SQL injection o backup expuesto permite a un atacante generar códigos TOTP válidos para cada usuario con 2FA habilitado, eliminando completamente el segundo factor.
- **Corrección:** Cifrar con la misma infraestructura AES-256-GCM usada en `AiProviderSetting`. Almacenar como `encrypted_two_factor_secret`. Descifrar en el servicio antes de verificar.
- **Prueba:** Verificar en test que la columna `two_factor_secret` en BD no contiene el seed en plano.

---

## Hallazgos no bloqueantes

### AUTH-H1 — Rate limiter en memoria: inefectivo en despliegues multi-instancia
- **Severidad:** ALTA
- **Archivo:** `backend/src/app.module.ts:37–43`
- **Descripción:** `ThrottlerModule.forRoot()` usa almacenamiento en memoria por defecto. En Railway con múltiples réplicas, cada pod mantiene contadores independientes. Un ataque distribuido que distribuya requests entre pods elude todos los límites de tasa de login (5/min), reset de contraseña (3/min), 2FA (5/min) y registro de organización (5/min).
- **Corrección:** Instalar `@nestjs-throttler/storage-redis` y configurar Redis compartido para todos los pods.

---

### AUTH-H2 — Tokens JWT sin `sid` son irrevocables
- **Severidad:** ALTA
- **Archivo:** `backend/src/auth/jwt.strategy.ts:66–84`
- **Descripción:** Tokens emitidos antes de implementar el tracking de sesiones (sin campo `sid`) eluden completamente la validación de sesión. El logout, la revocación por el usuario y la revocación por admin no tienen efecto sobre estos tokens durante su TTL de 12 horas.
- **Corrección:** Rechazar incondicionalmente tokens sin `sid`: `if (!payload.sid) throw new UnauthorizedException()`.

---

### AUTH-H3 — Auto-registro de organización abierto sin restricción
- **Severidad:** ALTA
- **Archivo:** `backend/src/auth/auth.controller.ts:83–93`, `backend/src/auth/auth.service.ts:555–622`
- **Descripción:** `POST /auth/register-organization` es completamente público con rate limit en memoria (bypassable). Cualquier actor no autenticado puede aprovisionar organizaciones ilimitadas con cuentas ADMIN.
- **Corrección:** Requerir una clave de API pre-compartida (`X-Registration-Key`) o un flujo de invitación previo. Aplicar throttle mucho más estricto respaldado por Redis.

---

### AUTH-H4 — IP spoofable en fingerprint de sesión
- **Severidad:** ALTA
- **Archivo:** `backend/src/auth/auth.controller.ts:46–55`, `backend/src/auth/auth.service.ts:278–286`
- **Descripción:** `getRequestContext()` lee `X-Forwarded-For` directamente de headers raw. Un atacante puede inyectar la IP de la víctima para colisionar con su sesión existente y rotar su `token_jti`, invalidando el token activo de la víctima.
- **Corrección:** Usar solo `req.ip` (sanitizado por Express según `trust proxy` configurado); eliminar la extracción manual de `X-Forwarded-For`.

---

### AUTH-H5 — `owner_id` de invitación no validado contra organización
- **Severidad:** ALTA
- **Archivo:** `backend/src/auth/auth.service.ts:539`
- **Descripción:** Cuando `invitation.owner_id` es null, el usuario registrándose puede proveer un `owner_id` arbitrario desde el DTO sin validación de existencia ni pertenencia organizacional.
- **Corrección:** Validar que `registerDto.owner_id` exista y pertenezca a `invitation.organization_id` antes de crear el usuario.

---

### MT-C1 — Webhook de Cloudflare: verificación HMAC eludible con header ausente
- **Severidad:** ALTA (bloqueante de integridad de datos)
- **Archivo:** `backend/src/cloudflare/cloudflare-webhook.controller.ts:32–37`
- **Descripción:** La condición `else if (signature)` significa que si el header `webhook-signature` está simplemente ausente, la verificación HMAC se omite completamente aunque el secreto esté configurado. Un atacante que descubra la URL del webhook puede enviar eventos falsos (marcar uploads como `ready` o `failed`) sin autenticación.
- **Escenario:** `POST /webhooks/cloudflare/stream` sin header de firma → acepta payload → crea `ServiceAttachment` para un `cf_stream_uid` conocido.
- **Corrección:** 
  ```typescript
  if (secret) {
    if (!signature) throw new ForbiddenException('Missing webhook signature');
    this.verifySignature(signature, JSON.stringify(body), secret);
  }
  ```

---

### SEC-H1 — Directorio `/uploads` servido sin autenticación
- **Severidad:** ALTA
- **Archivo:** `backend/src/app.module.ts:52–59`
- **Descripción:** `ServeStaticModule` monta todo `uploads/` en `/uploads` para cualquier entorno donde `NODE_ENV !== 'production'`. No hay guard de autenticación, CORS ni verificación de visibilidad por archivo. Archivos con `visibility: 'private'` son accesibles públicamente.
- **Corrección:** Eliminar `ServeStaticModule`. Servir archivos locales a través de un controller NestJS con guard JWT.

---

### SEC-H2 — Path traversal en `LocalStorageService.deleteFile`
- **Severidad:** ALTA
- **Archivo:** `backend/src/storage/local-storage.service.ts:57–61`
- **Descripción:** El método usa `fileRef.replace('/uploads/', '')` (solo reemplaza la primera ocurrencia) seguido de `path.join` sin verificar que el path resultante permanezca dentro de `uploadDir`. `deleteFile('/uploads/../../../main.js')` puede eliminar archivos arbitrarios del servidor.
- **Corrección:** Después de construir `filePath`, verificar que comience con `path.resolve(this.uploadDir)` antes de proceder.

---

### SEC-H3 — Subdominio real de Cloudflare Stream hardcodeado en código fuente
- **Severidad:** ALTA
- **Archivo:** `backend/src/cloudflare/cloudflare.service.ts:46`
- **Descripción:** El valor default `'customer-yrufylz27agxoaqz.cloudflarestream.com'` está quemado en el código fuente y en el historial de git. Expone la cuenta de CF Stream y permite que atacantes intenten acceder a streams por UID si los URLs firmados no están habilitados.
- **Corrección:** Eliminar el valor default. Requerir `CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN` explícitamente en la verificación de env de producción.

---

### SEC-H4 — CORS acepta todos los orígenes cuando `CORS_ORIGIN` no está configurado
- **Severidad:** ALTA
- **Archivo:** `backend/src/main.ts:94–97`
- **Descripción:** En entornos non-production con `allowedOrigins` vacío, el backend acepta cualquier origen con `credentials: true`. Un entorno de staging expuesto a internet sin `CORS_ORIGIN` configurado permite CSRF y exfiltración de datos desde sesiones autenticadas.
- **Corrección:** Fallar cerrado cuando `allowedOrigins` esté vacío independientemente del entorno. Documentar que staging requiere `CORS_ORIGIN`.

---

### FE-H1 — Access token almacenado en `localStorage` (accesible por XSS)
- **Severidad:** ALTA
- **Archivo:** `frontend/src/lib/AuthContext.tsx:51,94`, `frontend/src/lib/api.ts:51`
- **Descripción:** El JWT se escribe en `localStorage`. No hay equivalente a `httpOnly` para `localStorage`. Cualquier XSS (script de terceros, analytics maliciosos) puede leer `localStorage.getItem('access_token')` y exfiltrar el token.
- **Corrección:** Migrar a cookies `httpOnly; Secure; SameSite=Strict` configuradas desde el backend en la respuesta de login. El frontend nunca toca el token en JavaScript.

---

### FE-H2 — Tokens de upload firmados persistidos en `localStorage`
- **Severidad:** ALTA
- **Archivo:** `frontend/src/providers/UploadQueueProvider.tsx:52–66,84`
- **Descripción:** La función `persistedShape` guarda el objeto `intent` completo en `localStorage` bajo `fentri.uploadQueue.v1`. El tipo `UploadIntent` contiene `signedUploadToken`, `tusEndpoint`, `cfStreamUploadUrl` — credenciales para subir archivos directamente al storage. Combinado con FE-H1, un XSS obtiene acceso para subir contenido arbitrario.
- **Corrección:** Excluir el campo `intent` de `persistedShape`. Re-solicitar el intent desde la API cuando el usuario reanude una carga.

---

### FE-H3 — Control de roles completamente client-side
- **Severidad:** ALTA
- **Archivo:** `frontend/src/lib/AuthContext.tsx:22–31,111–145`
- **Descripción:** `ROUTE_PERMISSIONS` y `canAccess()` son React hooks que corren en `useEffect`. Un usuario `WORKER` puede acceder a rutas de ADMIN en la ventana entre montaje del componente y ejecución del efecto. La seguridad real depende del backend, pero el frontend no agrega ninguna capa de defensa en profundidad.
- **Corrección:** Decodificar el claim de rol del JWT en `middleware.ts` (usando `jose`, compatible con Edge) y verificar contra los permisos de la ruta antes de servir el HTML.

---

### DB-H1 — `UserSession.organization_id` sin FK constraint
- **Severidad:** ALTA
- **Archivo:** `backend/prisma/schema.prisma:230–251`
- **Descripción:** El campo existe pero no tiene relación declarada ni FK en BD. Sesiones pueden referenciar organizaciones inexistentes. No hay índice compuesto `(organization_id, expires_at)` para limpieza eficiente por org.
- **Corrección:** Agregar `@relation(...)` con `onDelete: SetNull` e índice `@@index([organization_id, expires_at])`.

---

### DB-H2 — `WorkerAssetAccess` sin restricción de misma organización
- **Severidad:** ALTA
- **Archivo:** `backend/prisma/schema.prisma:580–593`
- **Descripción:** No existe FK compuesta ni CHECK que garantice que el worker y el asset en `WorkerAssetAccess` pertenecen a la misma organización. Un grant inválido (por bug o acceso directo a BD) permite acceso cross-tenant.
- **Corrección:** Agregar `organization_id` a la tabla con FK compuesta, o CHECK que valide `worker.organization_id = asset.organization_id`.

---

### DB-H3 — Dashboard raw SQL omite filtro `purged_at`
- **Severidad:** ALTA
- **Archivo:** `backend/src/dashboard/dashboard.service.ts:286,334`
- **Descripción:** Los builders de SQL crudo incluyen `"deleted_at" IS NULL` pero omiten `"purged_at" IS NULL`. Servicios purgados (borrados permanentemente) aparecen en gráficos y métricas del dashboard.
- **Corrección:** Agregar `AND "purged_at" IS NULL` a las condiciones iniciales en ambos métodos.

---

### DB-H4 — Usuarios purgados visibles en listados y estadísticas
- **Severidad:** ALTA
- **Archivo:** `backend/src/users/users.service.ts:114,198`
- **Descripción:** `buildStatsWhere()` y el builder de `findAll()` filtran solo `deleted_at: null` sin `purged_at: null`. Usuarios purgados (eliminación irreversible, potencialmente por GDPR) aparecen en listados de ADMIN. Viola el derecho al olvido.
- **Corrección:** Agregar `purged_at: null` en ambos builders.

---

### MT-H1 — Oracle de existencia via tipos de excepción divergentes (IDOR)
- **Severidad:** ALTA
- **Archivo:** `backend/src/assets/assets.service.ts:549,560,611`, `backend/src/services/services.service.ts:1524`
- **Descripción:** Todos estos métodos hacen `findUnique({ where: { id } })` sin scope de organización. Luego comprueban `asset.organization_id !== user.orgId` y devuelven **403** (versus **404** si el recurso no existe). Un atacante puede distinguir UUIDs que existen en otras organizaciones por el código de respuesta.
- **Escenario:** ADMIN de Org B prueba `DELETE /assets/<uuid>`. Si UUID es de Org A → 403. Si no existe → 404. Diferencia de respuesta = oracle de enumeración.
- **Corrección:** Incluir `organization_id` en el `where` inicial para devolver un 404 unificado en ambos casos.

---

### MT-M1 — SUPER_ADMIN en Trash accede datos de todas las organizaciones
- **Severidad:** MEDIA
- **Archivo:** `backend/src/trash/trash.controller.ts:33–44,65–71,82–88`
- **Descripción:** `req.user.orgId` puede ser `undefined` para SUPER_ADMIN. Prisma ignora filtros con valor `undefined` en el `where`, resultando en queries sin scope de organización. `GET /trash` devuelve datos eliminados de todos los tenants.
- **Corrección:** Verificar explícitamente si el acceso global es intencional; si no, lanzar `BadRequestException` cuando `orgId` es undefined.

---

### FE-M1 — Tokens sensibles expuestos en parámetros URL
- **Severidad:** MEDIA
- **Archivo:** `frontend/src/app/(auth)/reset-password/page.tsx:19–20`, `frontend/src/app/(auth)/register/page.tsx:33–34`
- **Descripción:** Tokens de reset de contraseña y de invitación llegan en `?token=`. Los query strings quedan en historial del navegador, logs de servidor, headers Referrer y herramientas de analytics.
- **Corrección:** Llamar `window.history.replaceState({}, '', '/reset-password')` inmediatamente después de extraer el token para eliminarlo del historial.

---

### DB-M1 — Sin políticas RLS en ninguna tabla
- **Severidad:** MEDIA
- **Archivo:** Todas las migraciones; `backend/supabase_schema.sql` (vacío)
- **Descripción:** Cero `ENABLE ROW LEVEL SECURITY` o `CREATE POLICY` en cualquier migración. Todo el aislamiento multi-tenant es únicamente a nivel de aplicación. Una `DATABASE_URL` filtrada expone todos los datos de todos los tenants sin restricción.
- **Corrección:** Implementar RLS básico en todas las tablas con scope de tenant usando variable de sesión `app.current_organization_id`.

---

### DB-M2 — `StoredFile.size_bytes` es `Int` (overflow en archivos >2.1 GB)
- **Severidad:** MEDIA
- **Archivo:** `backend/prisma/schema.prisma:554`
- **Descripción:** `size_bytes Int?` mapea a `integer` de 32 bits en PostgreSQL. `FileUpload.declared_size_bytes` y `actual_size_bytes` son correctamente `BigInt`. Videos y documentos grandes pueden superar 2,147,483,647 bytes, causando overflow silencioso y quota bypass.
- **Corrección:** Migrar `size_bytes` a `BigInt?`.

---

### AUTH-M1 — Comparación de código 2FA por email no es constant-time
- **Severidad:** MEDIA
- **Archivo:** `backend/src/auth/auth.service.ts:1051,1110,1257`
- **Descripción:** Comparaciones con `!==` / `===` son short-circuit. Un oráculo de timing podría filtrar dígitos del código esperado si el rate limit es bypassable (ver AUTH-H1).
- **Corrección:** Usar `crypto.timingSafeEqual(Buffer.from(emailToken.token), Buffer.from(code))`.

---

### AUTH-M2 — Contraseña mínima de 6 caracteres en múltiples flujos
- **Severidad:** MEDIA
- **Archivo:** `backend/src/auth/dto/register-organization.dto.ts:24`, `backend/src/auth/dto/reset-password.dto.ts:12`
- **Descripción:** Auto-registro y reset de contraseña permiten contraseñas de 6 caracteres. `create-user.dto.ts` requiere 8. Sin política de complejidad en ningún lado.
- **Corrección:** Estandarizar a mínimo 12 caracteres en todos los flujos.

---

### AUTH-M3 — Sin lockout por cuenta tras fallos de login consecutivos
- **Severidad:** MEDIA
- **Archivo:** `backend/src/auth/auth.service.ts:366–435`
- **Descripción:** Los intentos fallidos solo se limitan por IP (en memoria, bypassable). No existe contador persistente por cuenta. Un ataque distribuido desde múltiples IPs puede intentar contraseñas ilimitadas contra una cuenta específica.
- **Corrección:** Campos `failed_login_count` y `locked_until` en el modelo `User`; lockout exponencial tras N fallos (e.g., 10).

---

### PERF-H1 — Consultas sin paginación retornan listas sin límite
- **Severidad:** ALTA (rendimiento)
- **Archivo:** `backend/src/assets/assets.service.ts:332–337`, `backend/src/services/services.service.ts:973–1036`
- **Descripción:** Cuando no se proveen parámetros de paginación, `findMany` se ejecuta sin cláusula `take`. Con 100K activos, una sola llamada carga todos en heap de Node.js junto con sus relaciones eager-loaded. OOM garantizado.
- **Corrección:** Eliminar el código path sin paginación. Aplicar un `take` máximo obligatorio (e.g., 500). Implementar paginación basada en cursor para exportaciones.

---

### PERF-H2 — N+1 secuencial en `reconcileOrganization`
- **Severidad:** ALTA (rendimiento)
- **Archivo:** `backend/src/uploads/upload-reconciliation.service.ts:100–163`
- **Descripción:** `recordIssue` se llama dentro de tres loops separados con `await` (2 round-trips de BD por iteración). El loop de `refreshServiceAttachmentSnapshot` también es secuencial. Con 10K archivos por org: 20K+ round-trips secuenciales de BD.
- **Corrección:** Pre-cargar todos los issues existentes con un `findMany`, construir un Set, usar `createMany` para los nuevos. Reemplazar el loop de snapshot con una query batch.

---

### PERF-H3 — `assertCanStore` hace SUM completo en cada upload
- **Severidad:** ALTA (rendimiento)
- **Archivo:** `backend/src/storage/storage-governance.service.ts:111–118`
- **Descripción:** En cada upload se ejecuta `prisma.storedFile.aggregate({ _sum: { size_bytes } })` sobre toda la tabla `StoredFile` de la organización. La tabla `OrganizationStorageUsage` existe como agregado pre-computado pero no se consulta aquí. Con 500K filas por org: full table scan en cada upload.
- **Corrección:** Reemplazar con `organizationStorageUsage.findUnique({ where: { organization_id } })` y usar `ready_bytes + reserved_bytes`.

---

### PERF-H4 — Uploads de archivos secuenciales en `services.create`
- **Severidad:** ALTA (rendimiento)
- **Archivo:** `backend/src/services/services.service.ts:540–569`
- **Descripción:** Hasta 30 adjuntos se suben uno a la vez (cada `await` espera el upload + insert de BD). Con 30 archivos de 10MB: 60–120+ segundos. El timeout del load balancer (típicamente 60s) mata la conexión antes de completar.
- **Corrección:** Convertir a uploads paralelos: `await Promise.all(files.map(f => uploadAndRegister(f)))`.

---

### PERF-H5 — `getOrganizationUsage` hace N requests de storage API por archivo
- **Severidad:** ALTA (rendimiento)
- **Archivo:** `backend/src/storage/storage-governance.service.ts:74–82`
- **Descripción:** `listOrganizationFileRefs` retorna todos los archivos de la org, luego `getFileSize` hace un HEAD request al storage por cada uno. Con 50K archivos: 50K requests HTTP simultáneos que agotarán los rate limits del storage provider.
- **Corrección:** Usar la tabla `OrganizationStorageUsage` pre-computada. Este método no debería existir en producción.

---

### SEC-M1 — MIME type de documentos Office verificado solo por extensión
- **Severidad:** MEDIA
- **Archivo:** `backend/src/common/files/document-validation.ts:74–87`
- **Descripción:** DOCX y XLSX son ZIPs válidos. La desambiguación se basa en `file.originalname`. Renombrar un ZIP malicioso como `malware.docx` supera toda validación. Un ZIP bomb también pasa.
- **Corrección:** Abrir el ZIP y verificar que existan las entradas internas esperadas (`[Content_Types].xml`, `word/document.xml` para DOCX; `xl/workbook.xml` para XLSX). Implementar límite de tamaño descomprimido.

---

### SEC-M2 — Cache de URLs firmadas sin límite de tamaño (memoria no acotada)
- **Severidad:** MEDIA
- **Archivo:** `backend/src/storage/supabase-storage.service.ts:33,196–202`
- **Descripción:** `signedUrlCache = new Map<>()` crece sin límite. La poda de entradas expiradas se ejecuta con probabilidad 1%. Una carga masiva de archivos únicos (exportación, reporte) puede causar OOM en el proceso.
- **Corrección:** Limitar el cache a 5,000 entradas usando LRU eviction (`lru-cache` npm). Ejecutar limpieza en timer programado.

---

### SEC-M3 — Sin request ID: correlación de incidentes imposible
- **Severidad:** MEDIA
- **Archivo:** `backend/src/main.ts`, `backend/src/common/filters/all-exceptions.filter.ts`
- **Descripción:** No existe middleware que genere un ID de request. Los errores en logs no tienen correlación con reportes de usuarios. Cuando múltiples errores 500 ocurren simultáneamente, no hay forma de identificar cuál corresponde a cuál.
- **Corrección:** Middleware temprano que lea `X-Request-ID` o genere un UUID; propagarlo en logs y en el body de error.

---

## Cobertura multi-tenant

| Recurso | Lectura | Creación | Actualización | Eliminación | Protección Backend | Protección RLS | Estado |
|---|---|---|---|---|---|---|---|
| **Organization** | Scoped (me) | N/A | Scoped | N/A | Sí | No | ⚠️ Sin RLS |
| **User** | Scoped por org | Scoped | Scoped | Soft-delete scoped | Sí | No | ⚠️ purged_at sin filtrar |
| **Asset** | Scoped | Scoped | ⚠️ Existence oracle | ⚠️ Existence oracle | Parcial | No | 🔴 FK cross-tenant eliminada |
| **Service** | Scoped | Scoped | ⚠️ findUnique sin scope | ⚠️ Existence oracle | Parcial | No | 🔴 FK cross-tenant eliminada |
| **Owner (Company)** | Scoped | Scoped | Scoped | Scoped | Sí | No | ⚠️ Sin RLS |
| **StoredFile** | Scoped | Scoped | N/A | Scoped | Sí | No | ⚠️ Sin RLS |
| **Invitation** | Scoped | Scoped | N/A | Scoped | Sí | No | ⚠️ owner_id sin FK |
| **ServiceShareLink** | Token público | Scoped | Scoped | Scoped | Sí | No | ✅ Bien implementado |
| **UserSession** | Scoped | Scoped | N/A | Scoped | Sí | No | ⚠️ Sin FK a org |
| **WorkerAssetAccess** | Scoped | Scoped | N/A | Scoped | Sí | No | 🔴 Sin constraint mismo-org |
| **Subscription** | Scoped | Super Admin | Super Admin | N/A | Sí | No | ⚠️ FK user faltante |
| **Dashboard** | Scoped | N/A | N/A | N/A | Parcial | No | ⚠️ asset lookup sin org scope |
| **Trash** | ⚠️ Super Admin unscoped | N/A | N/A | ⚠️ Super Admin unscoped | Parcial | No | ⚠️ undefined orgId |
| **AiProviderSetting** | Global | Super Admin | Super Admin | N/A | Sí | No | ⚠️ Sin scope por org |

**Leyenda:** ✅ Correcto | ⚠️ Riesgo menor | 🔴 Bloqueante

---

## Revisión de migraciones y base de datos

### Problemas encontrados

1. **Migración `20260517145921` eliminó dos FKs de aislamiento sin restaurarlas** (ver DB-C1 — Bloqueante)
2. **Dos migraciones llamadas `init_local`** (`20260607043818` y `20260628010734`) son en realidad cambios incrementales — naming engañoso para operadores
3. **Migraciones destructivas sin rollback scripts:** `20260517000200` (elimina 5 columnas de URL), `20260516205000` (elimina columnas de owner en StoredFile), `20260516210000` (elimina enum CLIENT). Sin backups previos al apply, son irrecuperables
4. **Script manual** `202605_phase7_4_clear_business_data.sql` en directorio `manual/` — operación destructiva sin tracking en `_prisma_migrations`

### Índices faltantes

| Tabla | Columnas | Impacto |
|---|---|---|
| `StoredFile` | `(organization_id, status)` | Full scan en `assertCanStore` (PERF-H3) |
| `Asset` | `(organization_id, deleted_at, is_active)` | Filtro principal de `findAll` ineficiente |
| `Asset` | `(organization_id, owner_id)` | Filtro por owner sin índice compuesto |
| `Owner` | `(organization_id, is_active)` | `getFilterOptions` escanea toda la tabla |
| `FileUpload` | `(organization_id, status, expires_at)` | Cleanup job sin índice eficiente |
| `UserSession` | `(organization_id, expires_at)` | Limpieza de sesiones por org |
| `Service` | `(organization_id, deleted_at)` | Queries de listado sin índice compuesto |

### Restricciones faltantes

| Tabla | Campo | Tipo de restricción faltante |
|---|---|---|
| `Asset` | `(owner_id, organization_id)` | FK compuesta mismo-org (eliminada) |
| `Service` | `(asset_id, organization_id)` | FK compuesta mismo-org (eliminada) |
| `WorkerAssetAccess` | `organization_id` | FK compuesta mismo-org |
| `UserSession` | `organization_id` | FK a Organization |
| `AiProviderSetting` | `configured_by_user_id` | FK a User con ON DELETE SET NULL |
| `Subscription` | `pending_plan_requested_by` | FK a User con ON DELETE SET NULL |
| `Invitation` | `owner_id` | FK a Owner |
| `StoredFile` | `size_bytes` | Debe ser BigInt (no Int) |

### Riesgos de integridad

- **Cascadas destructivas:** `FileUpload → Service (CASCADE)`, `ServiceTranslation → Service (CASCADE)`, `UserSession → User (CASCADE)` destruyen historial de auditoría en hard-deletes directos de Prisma. Actualmente mitigado por usar soft-delete, pero una llamada directa a `prisma.service.delete()` es irreversible.
- **Datos huérfanos:** Las 4 imágenes legacy en raíz de `uploads/` no tienen registro en `StoredFile`. El sistema de governance no las limpiará nunca.
- **`ServiceAttachment` sin `onDelete: Cascade`:** A diferencia de `ServiceTranslation` y `ServiceShareLink`, bloquea hard-delete de Service con FK violation.

---

## Pruebas faltantes

### Críticas (antes del primer cliente)

1. **E2E de autenticación:** Token temporal 2FA devuelve 401 en endpoints protegidos
2. **E2E de aislamiento:** Usuario de Org A no puede leer/escribir recursos de Org B (assets, services, owners)
3. **E2E de IDOR:** Cambiar `:id` en URL de asset/service devuelve 404 (no 403 ni 200)
4. **E2E de middleware:** Rutas protegidas devuelven 307 a `/login` sin autenticación (luego de fix del middleware)
5. **Integridad de FK:** INSERT de asset con owner de otra org falla en BD

### Altas (primera semana)

6. **Test de roles en backend:** WORKER no puede crear/editar usuarios; EXTERNAL no puede ver otros assets
7. **Test de tokens:** Token de reset de contraseña falla si se usa más de una vez
8. **Test de invitaciones:** Token de invitación expirado devuelve 400; token de otra org devuelve 400
9. **Test de paginación:** Endpoints de lista devuelven máximo N registros aunque existan más
10. **Test de quota:** `assertCanStore` usa `OrganizationStorageUsage`, no agrega sobre `StoredFile`
11. **Test de webhook:** Cloudflare webhook sin signature header devuelve 403

### Medias (primer mes)

12. Test de velocidad: `GET /assets` < 200ms con 1000 activos en BD
13. Test de archivo: upload de ZIP renombrado como `.docx` falla validación
14. Test de limpieza: archivos en `uploads/` sin `StoredFile` asociado son detectados por reconciliation
15. Test de sesiones: logout invalida la sesión en BD; token antiguo devuelve 401
16. Test de 2FA replay: mismo código TOTP enviado dos veces devuelve error en segundo intento
17. Test de purge: usuarios purgados no aparecen en listados de ningún endpoint
18. Security scan automatizado: `npm audit` y `snyk test` en CI

---

## Checklist de salida

### Autenticación y autorización

| Punto | Estado |
|---|---|
| JWT validado en cada request protegido | ✅ Aprobado |
| 2FA correctamente implementada end-to-end | 🔴 Bloqueante (AUTH-C1, AUTH-C2) |
| Tokens sensibles no almacenados en texto plano | 🔴 Bloqueante (AUTH-C3, DB-C2) |
| Rate limiting efectivo en endpoints de auth | ⏳ Pendiente (AUTH-H1 — Redis) |
| Lockout por cuenta tras fallos repetidos | ⏳ Pendiente (AUTH-M3) |
| Sesiones revocables inmediatamente | ⏳ Pendiente (AUTH-H2) |
| Registro de organización restringido | ⏳ Pendiente (AUTH-H3) |

### Aislamiento multi-tenant

| Punto | Estado |
|---|---|
| Todas las queries scoped por organization_id | ⏳ Pendiente (MT-H1, MT-M1, DB-H3,H4) |
| FK de base de datos garantizan mismo-org | 🔴 Bloqueante (DB-C1) |
| RLS habilitado en tablas tenant-scoped | ⏳ Pendiente (DB-M1) |
| WorkerAssetAccess valida mismo-org | ⏳ Pendiente (DB-H2) |
| IDOR no posible en assets/services | ⏳ Pendiente (MT-H1) |

### Frontend y cliente

| Punto | Estado |
|---|---|
| Middleware server-side protege rutas privadas | 🔴 Bloqueante (FE-C1) |
| Token no accesible desde JavaScript | ⏳ Pendiente (FE-H1, FE-H2, FE-H3) |
| Tokens en URL no persisten en historial | ⏳ Pendiente (FE-M1) |
| Content-Security-Policy configurado | ⏳ Pendiente (FE-L1) |

### Base de datos e integridad

| Punto | Estado |
|---|---|
| Migraciones aplicadas y consistentes | ⏳ Pendiente (DB-C1 restaurar FKs) |
| Usuarios purgados filtrados en todos los queries | 🔴 Bloqueante (DB-C3, DB-H4) |
| FK críticas presentes | ⏳ Pendiente (DB-H1–H5) |
| size_bytes como BigInt | ⏳ Pendiente (DB-M2) |
| Índices de rendimiento presentes | ⏳ Pendiente (PERF-H3, PERF-M5) |

### Archivos y storage

| Punto | Estado |
|---|---|
| Archivos de clientes no en git | 🔴 Bloqueante (SEC-C1) |
| Secretos no en código fuente | ⏳ Pendiente (SEC-H3 — subdominio CF) |
| Path traversal en local storage eliminado | ⏳ Pendiente (SEC-H2) |
| Webhook autenticado correctamente | ⏳ Pendiente (MT-C1) |
| MIME validation robusta | ⏳ Pendiente (SEC-M1) |
| Archivos privados no accesibles sin auth | ⏳ Pendiente (SEC-H1) |

### Observabilidad

| Punto | Estado |
|---|---|
| Request ID en todos los logs | ⏳ Pendiente (SEC-M3) |
| Errores silenciosos eliminados | ⏳ Pendiente |
| Slow query threshold configurado | ⏳ Pendiente |

### Rendimiento

| Punto | Estado |
|---|---|
| Paginación obligatoria en todos los endpoints de lista | ⏳ Pendiente (PERF-H1, PERF-H2) |
| Storage quota usa tabla pre-computada | ⏳ Pendiente (PERF-H3) |
| Uploads de archivos paralelos | ⏳ Pendiente (PERF-H4) |
| Dashboard stats cacheado | ⏳ Pendiente (PERF-M4) |

### Pruebas

| Punto | Estado |
|---|---|
| Tests E2E de aislamiento multi-tenant | ⏳ Pendiente |
| Tests de autenticación 2FA completos | ⏳ Pendiente |
| Security scan de dependencias en CI | ⏳ Pendiente |
| `npm audit` sin vulnerabilidades críticas | ❓ No verificable (requiere run) |

---

## Plan de corrección

### Antes del primer cliente (no negociable)

**Semana 0 — Bloqueantes críticos**

| # | Acción | Responsable | Estimado |
|---|---|---|---|
| 1 | Purgar archivos de clientes del historial de git (`git filter-repo`) | DevOps | 2h |
| 2 | Renombrar `proxy.ts` → `middleware.ts`; fix export default | Frontend | 1h |
| 3 | Agregar verificación de `payload.purpose` en `jwt.strategy.ts` | Backend | 1h |
| 4 | Implementar tracking de `two_factor_last_counter` para anti-replay TOTP | Backend | 3h |
| 5 | Hashear tokens de reset, invitación y 2FA email antes de persistir (SHA-256) | Backend | 4h |
| 6 | Mover secreto TOTP pendiente a BD; eliminar del JWT de setup | Backend | 3h |
| 7 | Nueva migración que restaure ambas FKs cross-tenant | Backend/DBA | 2h |
| 8 | Cifrar `two_factor_secret` en BD con AES-256-GCM | Backend | 3h |
| 9 | Agregar `purged_at: null` a queries de users (service + dashboard) | Backend | 1h |
| 10 | Fix webhook Cloudflare: rechazar requests sin signature header | Backend | 1h |
| 11 | Eliminar subdominio CF hardcodeado del código fuente | Backend | 30min |

### Primera semana

**Seguridad alta prioridad**

| # | Acción |
|---|---|
| 12 | Migrar access token a cookie `httpOnly; Secure; SameSite=Strict` (backend → frontend) |
| 13 | Excluir `intent` (tokens firmados) de `localStorage` en UploadQueueProvider |
| 14 | Instalar `@nestjs-throttler/storage-redis`; configurar Redis compartido |
| 15 | Rechazar tokens JWT sin `sid`; coordinar re-auth de sesiones existentes |
| 16 | Restringir auto-registro de org (clave API o invitación previa) |
| 17 | Fix path traversal en `LocalStorageService.deleteFile` |
| 18 | Fix CORS: fallar cerrado cuando `allowedOrigins` es vacío |
| 19 | Agregar existence oracle fix (incluir org en findUnique de assets/services) |
| 20 | Paginación obligatoria en `findAll` de assets y services |
| 21 | Reemplazar SUM aggregate de quota por tabla pre-computada |
| 22 | Strip de token de URL tras extracción (`history.replaceState`) |
| 23 | Agregar `/owners` y `/trash` al matcher del middleware |
| 24 | Implementar request ID en middleware y logs |

### Primer mes

**Deuda técnica y hardening**

| # | Acción |
|---|---|
| 25 | Implementar RLS básico en tablas tenant-scoped (defense in depth) |
| 26 | Migrar `StoredFile.size_bytes` a BigInt |
| 27 | Agregar FK faltantes (UserSession.organization_id, WorkerAssetAccess.same-org, AiProviderSetting.configured_by, Invitation.owner_id) |
| 28 | Fix `ServiceAttachment` → `onDelete: Cascade` |
| 29 | Convertir uploads secuenciales a paralelos en `services.create` |
| 30 | Refactorizar `reconcileOrganization` para eliminar N+1 (batch queries) |
| 31 | Implementar lockout por cuenta tras fallos de login |
| 32 | Estandarizar contraseña mínima a 12 caracteres en todos los flujos |
| 33 | Agregar validación profunda de estructura interna para DOCX/XLSX |
| 34 | Implementar LRU cache con límite para signed URLs |
| 35 | Cachear dashboard stats por `(orgId, dateRange)` con TTL 30s |
| 36 | Agregar Content-Security-Policy headers en Next.js |
| 37 | `npm audit` y `snyk test` integrados en CI como gate de calidad |
| 38 | Añadir índices compuestos faltantes (StoredFile status, Asset deleted_at+is_active, Owner is_active, FileUpload status+expires_at) |
| 39 | Purga y registro en `StoredFile` de archivos legacy en `uploads/` |
| 40 | Documentar explícitamente acciones de SUPER_ADMIN con scope global (Trash, AiSettings) |

---

## Apéndice: Resumen de hallazgos por severidad

| Severidad | Cantidad | IDs principales |
|---|---|---|
| CRÍTICA | 8 | AUTH-C1/C2/C3/C4, FE-C1, SEC-C1, DB-C1/C2 |
| ALTA | 21 | AUTH-H1–5, MT-C1, MT-H1, SEC-H1–4, FE-H1–3, DB-H1–4, PERF-H1–5 |
| MEDIA | 18 | AUTH-M1–3, MT-M1, SEC-M1–3, FE-M1, DB-M1/M2, PERF-M1–5, DB-H3 |
| BAJA | 15 | AUTH-L1–5, MT-L1/L2, SEC-L1–4, PERF-L1–3, FE-L1–4 |

**Total: 62 hallazgos**

---

*Informe generado mediante análisis estático completo del repositorio. Ningún código fue modificado durante la auditoría. Este documento debe tratarse como información confidencial.*
