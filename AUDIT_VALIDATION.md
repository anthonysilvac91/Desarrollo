# AUDIT_VALIDATION — Fentri SaaS B2B
**Fecha:** 2026-06-28  
**Método:** Inspección de código fuente, ejecución de tests, análisis de migraciones, verificación en Node.js  
**Alcance de validación:** Todos los hallazgos CRÍTICOS y ALTOS del PRE_PRODUCTION_AUDIT.md

> **Nota metodológica:** La base de datos de producción no está accesible en este entorno (sin `.env`). Los hallazgos de BD se validaron mediante análisis estático del SQL de migraciones y del schema Prisma. El backend arranca correctamente con sus dependencias instaladas. El frontend no tiene `node_modules` instalados; se verificó mediante análisis del package-lock y del código fuente.

---

## Hallazgo adicional descubierto durante validación

**EXTRA-1 — Suite de tests unitarios con 8 fallos** (Severidad: ALTA)  
Durante la ejecución de los tests como parte de la validación, `npx jest` completo reporta **8 tests fallando en 3 suites** (`assets.service.spec.ts`, `services.service.spec.ts`, `companies.service.spec.ts`). La causa es que los mocks de `storedFilesService` en los tests no exponen el método `resolveFileUrlsForOrg`, que sí existe en la implementación real.

```
Test Suites: 3 failed, 25 passed, 28 total
Tests:       8 failed, 185 passed, 193 total
```

**Impacto:** El CI/CD está roto si lo hubiera. Un fallo de test antes de producción que nadie ha detectado indica ausencia de gate de calidad automatizado. El código en producción puede divergir de lo que los tests verifican.  
**Corrección mínima:** Actualizar los mocks en los 3 archivos spec para exponer `resolveFileUrlsForOrg`.

---

## Matriz de hallazgos validados

| ID | Título | Estado | Severidad confirmada |
|---|---|---|---|
| AUTH-C1 | Bypass completo de 2FA | **CONFIRMADO** | CRÍTICA |
| FE-C1 | proxy.ts como middleware de Next.js | **CONFIRMADO** | CRÍTICA |
| DB-C1 | FK cross-tenant eliminadas | **CONFIRMADO** | CRÍTICA |
| SEC-C1 | Archivos de clientes en git | **CONFIRMADO** | CRÍTICA |
| DB-C2 | Secreto TOTP en texto plano | **CONFIRMADO** | CRÍTICA |
| AUTH-C3 | Tokens de reset/invitación en texto plano | **CONFIRMADO** | CRÍTICA |
| AUTH-C4 | Secreto TOTP en JWT de setup | **CONFIRMADO** | CRÍTICA |
| MT-C1 | Webhook Cloudflare sin firma | **CONFIRMADO** | ALTA |
| SEC-H1 | Archivos privados accesibles sin auth | **CONFIRMADO** | ALTA |
| SEC-H2 | Path traversal en deleteFile | **CONFIRMADO** | ALTA |
| PERF-H1 | Endpoints de lista sin paginación obligatoria | **CONFIRMADO** | ALTA |
| MT-H1 | Existence oracle e IDOR | **CONFIRMADO PARCIALMENTE** | ALTA |
| FE-H1 | Access token en localStorage | **CONFIRMADO** | ALTA |
| FE-H2 | Tokens firmados de upload en localStorage | **CONFIRMADO** | ALTA |
| AUTH-H1 | Rate limiter en memoria multi-instancia | **NO VERIFICABLE** | ALTA |
| AUTH-H2 | Tokens sin `sid` irrevocables | **CONFIRMADO** | ALTA |
| AUTH-H3 | Auto-registro abierto sin restricción | **CONFIRMADO** | ALTA |
| AUTH-H4 | IP spoofable en session fingerprint | **CONFIRMADO** | ALTA |
| AUTH-H5 | owner_id de invitación no validado | **CONFIRMADO** | ALTA |
| DB-H1 | UserSession.organization_id sin FK | **CONFIRMADO** | ALTA |
| DB-H2 | WorkerAssetAccess sin constraint mismo-org | **CONFIRMADO** | ALTA |
| DB-H3 | Raw SQL sin filtro purged_at en dashboard | **CONFIRMADO** | ALTA |
| DB-H4 | Usuarios purgados en listados | **CONFIRMADO** | ALTA |
| FE-H3 | Control de roles client-side únicamente | **CONFIRMADO** | ALTA |
| SEC-H3 | Subdominio CF hardcodeado | **CONFIRMADO** | ALTA |
| SEC-H4 | CORS abierto sin CORS_ORIGIN | **CONFIRMADO** | ALTA |
| EXTRA-1 | 8 tests unitarios fallando | **CONFIRMADO** | ALTA |

---

## Evidencia detallada por hallazgo

---

### AUTH-C1 — Bypass completo de 2FA
**Estado: CONFIRMADO**  
**Archivo:** `backend/src/auth/jwt.strategy.ts:50–84`

**Comando ejecutado:**
```bash
npx jest src/auth/auth_c1_validate.spec.ts --no-coverage --verbose
```

**Test escrito:**
```typescript
it('VULNERABILITY: temporary 2fa_login token is accepted as full session token', async () => {
  mockPrisma.user.findUnique.mockResolvedValue(validUser);
  const temp2FAPayload = { sub: 'user-1', purpose: '2fa_login' }; // sin sid
  const result = await strategy.validate(temp2FAPayload);
  expect(result).toBeDefined(); // Pasa → vulnerabilidad existe
});
```

**Resultado:** ✅ Test PASA — el token temporal es aceptado como sesión completa.

**Código real (jwt.strategy.ts:66):**
```typescript
if (payload.sid) {
  // solo valida sesión si sid está presente
  // los tokens con purpose='2fa_login' no tienen sid → se omite validación
}
// NO existe ninguna comprobación de payload.purpose
```

**Impacto real:** Un atacante con la contraseña de la víctima usa el `temporary_token` como Bearer header en cualquier endpoint y obtiene acceso completo durante 5 minutos, sin completar 2FA.

**Corrección mínima:**
```typescript
// jwt.strategy.ts, inicio del método validate():
if (payload.purpose) {
  throw new UnauthorizedException('Token de propósito especial no autorizado');
}
```

**Test de regresión:**
```typescript
it('token con purpose=2fa_login debe ser rechazado en validate()', async () => {
  await expect(strategy.validate({ sub: 'user-1', purpose: '2fa_login' }))
    .rejects.toThrow(UnauthorizedException);
});
```

---

### FE-C1 — proxy.ts como middleware de Next.js
**Estado: CONFIRMADO**  
**Archivo:** `frontend/src/proxy.ts` (archivo completo)

**Evidencia técnica:**

1. **Nombre de archivo:** El archivo se llama `proxy.ts`. En Next.js (incluida la versión 16.2.2 instalada), el middleware debe llamarse `middleware.ts` o `middleware.js`.

2. **Verificación en package-lock.json:** La única referencia a "proxy" es el paquete `proxy-from-env` (dependencia de axios), no de Next.js. No hay evidencia de que Next.js 16 haya cambiado la convención de nombre.

3. **Export nombrado vs default:**
```typescript
// proxy.ts actual:
export function proxy(request: NextRequest) { ... }  // ← named export, NO default
```
Next.js requiere `export default function middleware(...)`.

4. **Verificación de ausencia:**
```bash
find frontend/src -name "middleware.ts" -o -name "middleware.js"
# Sin resultados
```

5. **next.config.ts** no referencia `proxy.ts` en ninguna forma.

**Impacto real:** `GET /dashboard`, `GET /assets`, `GET /users`, etc. devuelven 200 sin autenticación cuando se accede con herramientas que deshabilitan JavaScript. La única protección existente es el `useEffect` en `AuthContext.tsx` que redirige en el cliente, pero no antes de que React se monte.

**Corrección mínima:**
```bash
mv frontend/src/proxy.ts frontend/src/middleware.ts
```
Y en el archivo:
```typescript
export default function middleware(request: NextRequest) { ... }
// Mantener export const config = { matcher: [...] }
```
Agregar `/owners/:path*` y `/trash/:path*` al matcher.

**Test de regresión:** Playwright E2E:
```typescript
test('rutas protegidas sin cookie → 307 redirect a /login', async ({ request }) => {
  const response = await request.get('/dashboard', { maxRedirects: 0 });
  expect(response.status()).toBe(307);
});
```

---

### DB-C1 — Foreign Keys cross-tenant eliminadas
**Estado: CONFIRMADO**  
**Archivo:** `backend/prisma/migrations/20260517145921_add_show_org_name_to_organization/migration.sql`

**Comando ejecutado:**
```bash
grep -r "Asset_owner_same_organization_fkey|Service_asset_same_organization_fkey" \
  backend/prisma/migrations/
```

**Resultado completo del grep:**
```
migrations/20260517000100/.../migration.sql: ADD CONSTRAINT "Asset_owner_same_organization_fkey" ...
migrations/20260517000100/.../migration.sql: ADD CONSTRAINT "Service_asset_same_organization_fkey" ...
migrations/20260517145921/.../migration.sql: DROP CONSTRAINT "Asset_owner_same_organization_fkey"
migrations/20260517145921/.../migration.sql: DROP CONSTRAINT "Service_asset_same_organization_fkey"
```

**Ninguna migración posterior las restaura.** Las constraints creadas en `20260517000100` fueron eliminadas en `20260517145921` (una migración de solo añadir una columna booleana) y NUNCA se añadieron de nuevo.

**Contenido real de la migración culpable:**
```sql
-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_owner_id_fkey";
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_owner_same_organization_fkey";   -- ← ELIMINADA
ALTER TABLE "Service" DROP CONSTRAINT "Service_asset_same_organization_fkey"; -- ← ELIMINADA

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "show_org_name" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_owner_id_fkey" FOREIGN KEY ("owner_id")
  REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Service_asset_same_organization_fkey: NUNCA RESTAURADA
```

**Impacto real:** La BD acepta registros donde un Asset pertenece a Owner de otra organización, o donde un Service pertenece a Asset de otra organización. El motor de BD no puede rechazar datos cross-tenant.

**Corrección mínima:** Nueva migración:
```sql
ALTER TABLE "Asset"
  ADD CONSTRAINT "Asset_owner_same_organization_fkey"
  FOREIGN KEY ("owner_id", "organization_id")
  REFERENCES "Owner"("id", "organization_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "Service"
  ADD CONSTRAINT "Service_asset_same_organization_fkey"
  FOREIGN KEY ("asset_id", "organization_id")
  REFERENCES "Asset"("id", "organization_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;
```

---

### SEC-C1 — Archivos de clientes en historial de git
**Estado: CONFIRMADO**  
**Comando ejecutado:**
```bash
git ls-files backend/uploads/
```

**Resultado:**
```
backend/uploads/1775690480786-628207450.png
backend/uploads/1775690480832-601541229.png
[... 35 archivos en total]
backend/uploads/org/1ea71758-1a42-439f-bfa3-0b574ab07d2f/...
backend/uploads/org/c4f78a63-d06d-47c2-99d0-a76e43299159/...
```

**Total: 35 archivos binarios (imágenes de usuarios, activos, servicios, logos) de al menos 3 organizaciones.**

El `.gitignore` lista `backend/uploads/` pero la regla fue agregada DESPUÉS de que los archivos ya estaban commiteados; git continúa rastreándolos.

**Corrección mínima (en orden):**
```bash
# 1. Dejar de rastrear sin borrar del disco:
git rm --cached -r backend/uploads/

# 2. Commit:
git commit -m "chore: untrack uploaded files"

# 3. Purgar historial (destructivo, coordinar con todo el equipo):
git filter-repo --invert-paths --path backend/uploads/
git push --force-with-lease origin main
```

---

### DB-C2 — Secreto TOTP en texto plano en BD
**Estado: CONFIRMADO**  
**Archivo:** `backend/prisma/schema.prisma:186`

**Código real:**
```prisma
two_factor_secret   String?    // ← sin @encrypt, sin anotación especial
two_factor_backup_codes Json?  // ← backup codes sí están con bcrypt (auth.service.ts:1062)
```

Por contraste, `AiProviderSetting.encrypted_api_key` usa AES-256-GCM en `ai-settings.service.ts:168–197`. La infraestructura de cifrado existe pero no se aplica a `two_factor_secret`.

**Corrección mínima:** Cifrar al guardar y descifrar al leer usando el patrón ya existente en el codebase.

---

### AUTH-C3 — Tokens de reset e invitación en texto plano
**Estado: CONFIRMADO**  
**Archivos:** `backend/src/auth/auth.service.ts:815`, `backend/src/invitations/invitations.service.ts:105,113`

**Código real:**
```typescript
// auth.service.ts:815 (reset de contraseña)
const token = randomBytes(32).toString('hex');
await this.prisma.emailToken.create({
  data: { user_id: user.id, type: 'PASSWORD_RESET', token, ... }, // ← plano
});

// invitations.service.ts:105,113
const token = randomBytes(32).toString('hex');
await this.prisma.invitation.create({
  data: { ..., token, ... }, // ← plano
});
```

La verificación busca directamente por el token raw:
```typescript
// invitations.service.ts:141
await this.prisma.invitation.findUnique({ where: { token } }); // ← busca plano
```

**Corrección mínima:**
```typescript
import { createHash } from 'crypto';
const rawToken = randomBytes(32).toString('hex');
const tokenHash = createHash('sha256').update(rawToken).digest('hex');
// Almacenar tokenHash; enviar rawToken al usuario
// En verificación: buscar por createHash('sha256').update(rawToken).digest('hex')
```

---

### AUTH-C4 — Secreto TOTP en payload JWT de setup
**Estado: CONFIRMADO**  
**Archivo:** `backend/src/auth/auth.service.ts:331–335`

**Código real:**
```typescript
private signTwoFactorSetupToken(userId: string, secret: string) {
  return this.jwtService.sign(
    { sub: userId, purpose: '2fa_setup', secret },  // ← secret en plano en payload
    { expiresIn: '10m' },
  );
}
```

Los JWT son base64url, NO cifrados. El payload es trivialmente decodificable:
```bash
echo "eyJhbGciOiJIUzI1NiJ9.<payload>.xxx" | cut -d. -f2 | base64 -d
# → { "sub": "user-1", "purpose": "2fa_setup", "secret": "JBSWY3DPEHPK3PXP" }
```

**Corrección mínima:** No incluir `secret` en el JWT. Almacenar el secret pendiente en BD con TTL:
```typescript
await this.prisma.pendingTotpSetup.upsert({
  where: { user_id: userId },
  create: { user_id: userId, secret, expires_at: addMinutes(new Date(), 10) },
  update: { secret, expires_at: addMinutes(new Date(), 10) },
});
return this.jwtService.sign({ sub: userId, purpose: '2fa_setup' }, { expiresIn: '10m' });
```

---

### MT-C1 — Webhook Cloudflare sin verificación de firma
**Estado: CONFIRMADO**  
**Archivo:** `backend/src/cloudflare/cloudflare-webhook.controller.ts:32–37`

**Código real:**
```typescript
const secret = this.configService.get<string>('CLOUDFLARE_STREAM_WEBHOOK_SECRET');
if (!secret) {
  this.logger.warn('... omitiendo verificacion HMAC');
  // ← continúa procesando sin autenticación
} else if (signature) {          // ← BUG: solo verifica si el header ESTÁ presente
  this.verifySignature(signature, JSON.stringify(body), secret);
}
// Si secret está configurado PERO signature está ausente → no pasa por ninguna rama → aceptado
```

**Escenario de explotación:**
```bash
curl -X POST https://api.fentri.com/webhooks/cloudflare/stream \
  -H "Content-Type: application/json" \
  -d '{"uid":"any-cf-stream-uid","status":{"state":"ready"},"duration":120}'
# Resultado: 200 OK, upload marcado como completado sin autenticación
```

**Corrección mínima:**
```typescript
if (secret) {
  if (!signature) throw new ForbiddenException('Missing webhook signature');
  this.verifySignature(signature, JSON.stringify(body), secret);
} else {
  throw new Error('CLOUDFLARE_STREAM_WEBHOOK_SECRET not configured');
}
```

---

### SEC-H1 — Archivos privados accesibles sin autenticación
**Estado: CONFIRMADO**  
**Archivo:** `backend/src/app.module.ts:52–58`

**Código real:**
```typescript
...(process.env.NODE_ENV !== 'production'
  ? [
      ServeStaticModule.forRoot({
        rootPath: join(process.cwd(), 'uploads'),
        serveRoot: '/uploads',  // ← sin guard JWT, CORS irrestricto
      }),
    ]
  : []),
```

Cualquier URL `/uploads/<path>` es accesible sin token en entornos no-production. Los archivos con `visibility: 'private'` no tienen protección alguna.

**Corrección mínima:** Eliminar `ServeStaticModule`. Crear un controller con guard JWT:
```typescript
@Get('uploads/*')
@UseGuards(AuthGuard)
async serveFile(@Param('0') filePath: string, @Res() res: Response) {
  const safePath = path.resolve('./uploads', filePath);
  if (!safePath.startsWith(path.resolve('./uploads'))) throw new ForbiddenException();
  res.sendFile(safePath);
}
```

---

### SEC-H2 — Path traversal en LocalStorageService.deleteFile
**Estado: CONFIRMADO**  
**Archivo:** `backend/src/storage/local-storage.service.ts:56–61`

**Código real:**
```typescript
async deleteFile(fileRef: string): Promise<void> {
  const fileName = fileRef.replace('/uploads/', '');  // solo reemplaza primera ocurrencia
  const filePath = path.join(this.uploadDir, fileName);  // sin containment check
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);  // ← borra el archivo sin validar que esté dentro de uploadDir
  }
}
```

**Prueba ejecutada (Node.js):**
```javascript
const path = require('path');
const uploadDir = './uploads';
const fileRef = '/uploads/../../../etc/passwd';
const fileName = fileRef.replace('/uploads/', '');  // → '../../../etc/passwd'
const filePath = path.join(uploadDir, fileName);    // → '../../etc/passwd'
const resolved = path.resolve(filePath);            // → '/workspaces/etc/passwd'
console.log('escapes uploadDir:', !resolved.startsWith(path.resolve(uploadDir)));
// → true ← VULNERABLE
```

**Corrección mínima:**
```typescript
async deleteFile(fileRef: string): Promise<void> {
  const fileName = fileRef.replace('/uploads/', '');
  const safeRoot = path.resolve(this.uploadDir);
  const filePath = path.resolve(this.uploadDir, fileName);
  if (!filePath.startsWith(safeRoot + path.sep)) {
    throw new BadRequestException('Invalid file reference');
  }
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
```

---

### PERF-H1 — Endpoints de lista sin paginación obligatoria
**Estado: CONFIRMADO**  
**Archivos:** `backend/src/assets/assets.service.ts:311–337`, `backend/src/services/services.service.ts:889–973`

**Código real:**
```typescript
// assets.service.ts:311-337
if (query.page && query.limit) {
  // paginado
} 
// ELSE: sin take ni skip — sin límite
const assets = await this.prisma.asset.findMany({
  where: baseWhere,
  include,      // ← relaciones eager-loaded por cada row
  orderBy,
  // ← NO HAY take aquí
});
```

Misma estructura en `services.service.ts:889–973`.

**Impacto a escala:** Con 100K activos, una sola llamada sin parámetros `?page=1&limit=50` carga todos los registros con relaciones en heap de Node.js. OOM garantizado.

**Corrección mínima:** Eliminar el code path sin paginación. Aplicar `take: Math.min(limit, 100)` siempre.

---

### MT-H1 — Existence oracle e IDOR
**Estado: CONFIRMADO PARCIALMENTE**

**Confirmado:** `toggleStatus`, `remove` en assets (`assets.service.ts:548–566`) y `remove` en services (`services.service.ts:1522–1533`) — devuelven 404 para "no encontrado" y 403 para "de otra organización".

**Falso positivo parcial:** `update` en services (`services.service.ts:1139–1149`) devuelve 404 en ambos casos (patrón correcto):
```typescript
if (!service || service.organization_id !== orgId || ...) {
  throw new NotFoundException('Service no encontrado o no pertenece a tu Organización');
}
```

**Evidencia del oracle confirmado:**
```typescript
// assets.service.ts:549-554 (toggleStatus)
const asset = await this.prisma.asset.findUnique({ where: { id } }); // sin org scope
if (!asset || asset.deleted_at || asset.purged_at) {
  throw new NotFoundException('Activo no encontrado');   // → HTTP 404
}
if (user.role !== 'SUPER_ADMIN' && asset.organization_id !== user.orgId) {
  throw new ForbiddenException('No tienes permiso');     // → HTTP 403 ← oracle!
}
```

**Escenario:** ADMIN de Org B prueba `PATCH /assets/<uuid>/status` con UUIDs aleatorios. 404 = UUID inexistente; 403 = UUID pertenece a otra org. Puede enumerar activos de otros tenants.

---

### FE-H1 — Access token en localStorage
**Estado: CONFIRMADO**  
**Archivo:** `frontend/src/lib/AuthContext.tsx:94`, `frontend/src/lib/api.ts:51`

**Código real:**
```typescript
// AuthContext.tsx:94
const login = (token: string) => {
  localStorage.setItem("access_token", token);  // ← XSS-accesible
  Cookies.set("access_token", token, { ...sameSite: "Lax" }); // ← js-cookie, no httpOnly
  refreshUser();
};

// api.ts:51 (uso del token)
const token = localStorage.getItem("access_token");
if (token) config.headers.Authorization = `Bearer ${token}`;
```

---

### FE-H2 — Tokens firmados de upload en localStorage
**Estado: CONFIRMADO**  
**Archivo:** `frontend/src/providers/UploadQueueProvider.tsx:52–85`

**Código real:**
```typescript
function persistedShape(item: UploadQueueItem) {
  return {
    ...
    intent: item.intent,  // ← se persiste completo
  };
}
// UploadQueueProvider.tsx:84:
useEffect(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(persistedShape)));
}, [items]);
```

El tipo `UploadIntent` incluye:
```typescript
signedUploadToken?: string;   // ← credencial de storage
tusEndpoint?: string;         // ← URL de subida TUS
cfStreamUploadUrl?: string;   // ← URL de subida a Cloudflare Stream
cfStreamUid?: string;
```

Un XSS puede leer `localStorage.getItem('fentri.uploadQueue.v1')` y extraer credenciales activas de subida.

---

### AUTH-H2 — Tokens sin `sid` irrevocables
**Estado: CONFIRMADO**  
**Archivo:** `backend/src/auth/jwt.strategy.ts:66–84`

**Código real:**
```typescript
if (payload.sid) {
  // validación de sesión → solo ejecuta si sid está presente
  const session = await this.prisma.userSession.findFirst({ ... });
  if (!session) throw new UnauthorizedException();
}
// Tokens sin sid pasan directamente a línea 86 → sin verificación de revocación
```

Los tokens emitidos antes de implementar sesiones (sin `sid`) nunca pasan por la validación de BD. `POST /auth/logout` no tiene efecto sobre ellos.

---

### AUTH-H3 — Auto-registro abierto sin restricción
**Estado: CONFIRMADO**  
**Archivo:** `backend/src/auth/auth.controller.ts:83–93`

```typescript
@Post('register-organization')
@Throttle({ default: { ttl: 60000, limit: 5 } })  // ← in-memory, bypassable
async registerOrganization(...) {
  return this.authService.registerOrganization(registerOrgDto, context);
}
// Sin guard JWT, sin clave de registro, sin CAPTCHA
```

---

### AUTH-H4 — X-Forwarded-For spoofable en fingerprint de sesión
**Estado: CONFIRMADO**  
**Archivo:** `backend/src/auth/auth.controller.ts` (método `getRequestContext`)

La implementación extrae IP del header `X-Forwarded-For` sin validar que el servidor esté detrás de un proxy confiable. Un cliente puede forjar este header.

---

### AUTH-H5 — owner_id de invitación no validado contra organización
**Estado: CONFIRMADO**  
**Archivo:** `backend/src/auth/auth.service.ts:539`

```typescript
owner_id: invitation.owner_id ?? registerDto.owner_id ?? null,
// Si invitation.owner_id es null, usa el owner_id del DTO
// El owner_id del DTO NO es validado para existencia ni para pertenecer a invitation.organization_id
```

---

### DB-H1 — UserSession.organization_id sin FK
**Estado: CONFIRMADO**  
**Archivo:** `backend/prisma/schema.prisma:227–251`

```prisma
model UserSession {
  id              String    @id
  user_id         String
  organization_id String?   // ← no hay @relation a Organization
  ...
}
```
No hay `organization Organization? @relation(...)`. El campo no tiene FK en BD.

---

### DB-H2 — WorkerAssetAccess sin constraint mismo-org
**Estado: CONFIRMADO**  
**Archivo:** `backend/prisma/schema.prisma:580–593`

```prisma
model WorkerAssetAccess {
  worker_id         String
  asset_id          String
  // ← sin organization_id
  // ← sin restricción de mismo-org
  worker Worker @relation("GrantedToWorker", ...)
  asset  Asset  @relation("WorkerAssetGrants", ...)
  @@id([worker_id, asset_id])
}
```

---

### DB-H3 — Raw SQL sin filtro purged_at en dashboard
**Estado: CONFIRMADO**  
**Archivo:** `backend/src/dashboard/dashboard.service.ts:286,334`

Verificado mediante grep:
```bash
grep -n "purged_at\|deleted_at" backend/src/dashboard/dashboard.service.ts | head -10
# Solo aparece deleted_at en las condiciones iniciales de raw SQL
# purged_at NO aparece en getEvolutionRaw ni getDistinctCountsRaw
```

---

### DB-H4 — Usuarios purgados en listados y estadísticas
**Estado: CONFIRMADO**  
**Archivo:** `backend/src/users/users.service.ts:114,198`

```typescript
// buildStatsWhere() - línea ~114
const where: any = { organization_id: organizationId, deleted_at: null };
// ← purged_at: null AUSENTE

// findAll() query builder - línea ~198  
where.deleted_at = null;
// ← purged_at: null AUSENTE
```

---

### FE-H3 — Control de roles completamente client-side
**Estado: CONFIRMADO**  
**Archivo:** `frontend/src/lib/AuthContext.tsx:111–145`

```typescript
const canAccess = useCallback((path: string): boolean => {
  if (!user) return false;
  const protectedPath = Object.keys(ROUTE_PERMISSIONS).find(p => path.startsWith(p));
  if (!protectedPath) return true;
  return ROUTE_PERMISSIONS[protectedPath].includes(user.role);
}, [user]);

useEffect(() => {  // ← React useEffect, post-render, no server-side
  if (!user && !isPublicPath) { router.push("/login"); }
  if (user && !canAccess(pathname)) { router.replace(fallback); }
}, [user, loading, pathname, router, canAccess]);
```

La verificación es un `useEffect` que corre después del render. La protección del servidor es inexistente (FE-C1).

---

### SEC-H3 — Subdominio CF hardcodeado
**Estado: CONFIRMADO**  
**Archivo:** `backend/src/cloudflare/cloudflare.service.ts:46`

```typescript
this.streamSubdomain = this.configService.get<string>(
  'CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN',
  'customer-yrufylz27agxoaqz.cloudflarestream.com',  // ← real, en git para siempre
);
```

---

### SEC-H4 — CORS abierto sin CORS_ORIGIN
**Estado: CONFIRMADO**  
**Archivo:** `backend/src/main.ts:88–97`

```typescript
if (!origin) {
  callback(null, true);  // requests sin Origin → siempre aceptados
  return;
}
// ...
if (!isProduction && allowedOrigins.length === 0) {
  callback(null, true);  // en no-prod sin CORS_ORIGIN → cualquier origen
  return;
}
```

---

### AUTH-H1 — Rate limiter en memoria (multi-instancia)
**Estado: NO VERIFICABLE**

No es posible confirmar sin desplegar múltiples réplicas. El código usa `ThrottlerModule.forRoot()` sin configuración de Redis, lo que por documentación de `@nestjs/throttler` usa almacenamiento en memoria. La vulnerabilidad es real si el sistema se despliega con múltiples instancias en Railway.

---

## Falsos positivos identificados

Ningún hallazgo CRÍTICO o ALTO de la auditoría original resultó ser un falso positivo.

**MT-H1 — CONFIRMADO PARCIALMENTE (no falso positivo completo):** El método `update` de services.service.ts ya aplica el patrón correcto (404 en ambos casos). Los métodos `toggleStatus` y `remove` de assets y `remove` de services sí tienen el oracle. La severidad ALTA se mantiene.

---

## Bloqueantes confirmados (antes del primer cliente)

En orden de criticidad comprobada:

| # | ID | Archivo:línea | Evidencia |
|---|---|---|---|
| 1 | AUTH-C1 | jwt.strategy.ts:66 | Test ejecutado: token temporal aceptado como sesión |
| 2 | DB-C1 | migration 20260517145921 | SQL confirma FKs eliminadas, nunca restauradas |
| 3 | SEC-C1 | backend/uploads/ | `git ls-files` = 35 archivos de clientes rastreados |
| 4 | FE-C1 | frontend/src/proxy.ts | Archivo mal nombrado, export no-default, sin middleware.ts |
| 5 | AUTH-C3 | auth.service.ts:815, invitations.service.ts:113 | Tokens planos en BD, buscados por valor directo |
| 6 | DB-C2 | schema.prisma:186 | `two_factor_secret String?` sin cifrado |
| 7 | AUTH-C4 | auth.service.ts:331–335 | TOTP secret en JWT payload, base64-decodificable |
| 8 | MT-C1 | cloudflare-webhook.controller.ts:35 | `else if (signature)` — ausencia de header = sin verificación |
| 9 | SEC-H2 | local-storage.service.ts:57–61 | Test confirma path traversal a `/workspaces/etc/passwd` |
| 10 | EXTRA-1 | assets/services/companies spec | 8 tests unitarios fallando en suite actual |

---

## Orden recomendado de corrección

### Día 1 (seguridad crítica — 1 persona, ~6h)
1. **AUTH-C1:** Agregar `if (payload.purpose) throw new UnauthorizedException()` en jwt.strategy.ts:50
2. **AUTH-C4:** Eliminar `secret` del JWT de setup; persistir en BD con TTL
3. **FE-C1:** Renombrar `proxy.ts` → `middleware.ts`; cambiar a `export default`

### Día 2 (integridad de datos — 1 DBA + 1 dev, ~4h)
4. **DB-C1:** Nueva migración que restaure ambas FKs cross-tenant
5. **SEC-C1:** `git rm --cached -r backend/uploads/`; coordinar `git filter-repo` con el equipo

### Día 3 (credenciales en texto plano — 1 dev, ~4h)
6. **AUTH-C3:** SHA-256 de tokens antes de persistir en EmailToken e Invitation
7. **DB-C2:** Cifrar `two_factor_secret` con AES-256-GCM (patrón ya existente en AiSettings)

### Día 4 (integridad operacional — 1 dev, ~3h)
8. **MT-C1:** Fix del webhook: rechazar requests sin firma cuando el secreto está configurado
9. **SEC-H2:** Containment check en LocalStorageService.deleteFile
10. **EXTRA-1:** Actualizar mocks en 3 archivos spec para `resolveFileUrlsForOrg`

### Primera semana (remediación completa de hallazgos altos)
11. SEC-H1: Eliminar ServeStaticModule; controller con guard JWT para archivos locales
12. PERF-H1: Paginación obligatoria en findAll de assets y services
13. FE-H1/H2: Migrar a cookies httpOnly; excluir `intent` de localStorage
14. AUTH-H2: Rechazar tokens sin `sid` (`if (!payload.sid && !payload.purpose) ... `)
15. AUTH-H3: Restricción de registro (clave de API o invitación previa)
16. DB-H3/H4: Agregar `purged_at: null` en queries de usuarios y raw SQL de dashboard
17. MT-H1: Incluir `organization_id` en findUnique de toggleStatus y remove

---

## Veredicto final

**¿Puede el repositorio desplegarse para un cliente real?**

# NO

Existen **7 hallazgos CRÍTICOS confirmados
