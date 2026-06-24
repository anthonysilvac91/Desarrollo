# Recall — Sistema de Membresías y Planes Comerciales

> **Versión 1.0 — Junio 2026**
> Sin integración de pasarela de pago. Los cambios de plan son procesados manualmente por el SUPER_ADMIN.

---

## 1. Objetivo y alcance

Implementar un sistema de membresías multi-tier que permita:

- Al **SUPER_ADMIN** gestionar y asignar planes a cada `Organization` desde el panel maestro.
- A cada **ADMIN** de una `Organization` ver su plan actual y solicitar un cambio de plan.
- Una **modalidad DEMO** de 14 días con límites estrictos, sin pasarela de pago.
- **Guards en el backend** que bloqueen operaciones cuando se superan los límites del plan.

> ⚠️ **Esta implementación NO incluye Stripe ni ninguna pasarela de pago.** Los cambios de plan son manuales. El campo `payment_status` existe en el schema para preparar la v2.0.

---

## 2. Definición de planes

| Plan | Precio/mes | Usuarios internos | Activos | Storage | Video | Demo |
|---|---|---|---|---|---|---|
| `DEMO` | $0 | 3 | 20 | 1 GB | No | Sí (14 días) |
| `STARTER` | $49 | 3 | 100 | 5 GB | No | No |
| `PRO` | $149 | 10 | 500 | 50 GB | 10 hs/mes | No |
| `BUSINESS` | $349 | Ilimitado | Ilimitado | 200 GB | 50 hs/mes | No |
| `ENTERPRISE` | Custom | Ilimitado | Ilimitado | Custom | Custom | No |

**Features por plan:**

| Feature | DEMO | STARTER | PRO | BUSINESS | ENTERPRISE |
|---|---|---|---|---|---|
| Acceso externo (rol EXTERNAL / owners) | ❌ | ❌ | ✅ | ✅ | ✅ |
| Branding personalizado | ❌ | ❌ | ❌ | ✅ | ✅ |
| Traducción AI | ❌ | ❌ | ✅ | ✅ | ✅ |
| Upload de video | ❌ | ❌ | ✅ | ✅ | ✅ |

---

## 3. Schema de Prisma

**Archivo:** `backend/prisma/schema.prisma`

### 3.1 Nuevos enums

Agregar antes del modelo `Organization`:

```prisma
enum PlanTier {
  DEMO
  STARTER
  PRO
  BUSINESS
  ENTERPRISE
}

enum SubscriptionStatus {
  ACTIVE
  TRIALING
  SUSPENDED
  CANCELLED
}
```

### 3.2 Nuevo modelo Subscription

Agregar después del modelo `Organization`:

```prisma
model Subscription {
  id                        String             @id @default(uuid())
  organization_id           String             @unique
  plan                      PlanTier           @default(DEMO)
  status                    SubscriptionStatus @default(TRIALING)

  // Límites efectivos (sobreescribibles en ENTERPRISE)
  max_users                 Int                @default(3)
  max_assets                Int                @default(20)
  max_storage_gb            Float              @default(1.0)
  max_video_hours           Float              @default(0.0)
  allow_external            Boolean            @default(false)
  allow_branding            Boolean            @default(false)
  allow_ai_translation      Boolean            @default(false)

  // Demo
  demo_expires_at           DateTime?

  // Cambio de plan pendiente (SUPER_ADMIN confirma)
  pending_plan              PlanTier?
  pending_plan_requested_at DateTime?
  pending_plan_requested_by String?

  // Notas internas del SUPER_ADMIN (no visibles al ADMIN de la org)
  notes                     String?

  // Reservado para futura integración de pasarela de pago
  payment_status            String?

  created_at                DateTime           @default(now())
  updated_at                DateTime           @updatedAt

  organization              Organization       @relation(fields: [organization_id], references: [id])

  @@index([plan])
  @@index([status])
  @@index([demo_expires_at])
}
```

### 3.3 Relación en Organization

Dentro del modelo `Organization`, en la sección de relaciones, agregar:

```prisma
subscription  Subscription?
```

### 3.4 Migración

```bash
npx prisma migrate dev --name add_subscription_system
```

---

## 4. Backend — NestJS

### 4.1 Estructura de archivos a crear

```
backend/src/subscriptions/
  subscriptions.module.ts
  subscriptions.controller.ts
  subscriptions.service.ts
  plan-limits.ts                    ← constantes y tipos de cada plan
  check-plan-limit.decorator.ts     ← decorator @CheckPlanLimit()
  dto/
    update-subscription.dto.ts
    request-plan-change.dto.ts
```

### 4.2 `plan-limits.ts` — fuente de verdad de los límites

```typescript
// backend/src/subscriptions/plan-limits.ts

export interface PlanLimits {
  max_users: number;
  max_assets: number;
  max_storage_gb: number;
  max_video_hours: number;
  allow_external: boolean;
  allow_branding: boolean;
  allow_ai_translation: boolean;
  demo_duration_days: number | null;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  DEMO: {
    max_users: 3,
    max_assets: 20,
    max_storage_gb: 1,
    max_video_hours: 0,
    allow_external: false,
    allow_branding: false,
    allow_ai_translation: false,
    demo_duration_days: 14,
  },
  STARTER: {
    max_users: 3,
    max_assets: 100,
    max_storage_gb: 5,
    max_video_hours: 0,
    allow_external: false,
    allow_branding: false,
    allow_ai_translation: false,
    demo_duration_days: null,
  },
  PRO: {
    max_users: 10,
    max_assets: 500,
    max_storage_gb: 50,
    max_video_hours: 10,
    allow_external: true,
    allow_branding: false,
    allow_ai_translation: true,
    demo_duration_days: null,
  },
  BUSINESS: {
    max_users: 999999,
    max_assets: 999999,
    max_storage_gb: 200,
    max_video_hours: 50,
    allow_external: true,
    allow_branding: true,
    allow_ai_translation: true,
    demo_duration_days: null,
  },
  ENTERPRISE: {
    max_users: 999999,
    max_assets: 999999,
    max_storage_gb: 999999,
    max_video_hours: 999999,
    allow_external: true,
    allow_branding: true,
    allow_ai_translation: true,
    demo_duration_days: null,
  },
};
```

### 4.3 SubscriptionsService — métodos requeridos

| Método | Rol que lo llama | Descripción |
|---|---|---|
| `createForOrganization(orgId, plan?)` | Interno | Crea Subscription DEMO al crear nueva org. Llamar desde `OrganizationsService.create()`. |
| `findByOrg(orgId)` | Interno / ADMIN | Retorna el Subscription con datos de uso actual (consulta conteos reales de la DB). |
| `findAll(filters?)` | SUPER_ADMIN | Lista todos los subscriptions con nombre y slug de la org. Soporta filtro por `plan` y `status`. |
| `updatePlan(orgId, plan, overrides?, notes?)` | SUPER_ADMIN | Cambia plan inmediatamente. Aplica `PLAN_LIMITS`, acepta `overrides` para ENTERPRISE. Limpia `pending_plan`. Sincroniza `organization.is_active`. |
| `requestPlanChange(orgId, requestedPlan, userId)` | ADMIN | Guarda `pending_plan` y `pending_plan_requested_at`. No cambia el plan actual. |
| `approvePlanChange(orgId, approved)` | SUPER_ADMIN | Si `approved=true`, ejecuta `updatePlan` con `pending_plan`. Si `false`, limpia `pending_plan`. |
| `checkLimit(orgId, resource)` | Interno (guard) | Verifica que el recurso no supere el límite. Lanza `ForbiddenException` con código `PLAN_LIMIT_EXCEEDED` o `DEMO_EXPIRED`. |
| `suspendExpiredDemos()` | Cron diario | Busca subscriptions DEMO con `demo_expires_at < now()` y los pasa a `SUSPENDED`. Setea `organization.is_active = false`. |

#### Respuesta de `checkLimit` al exceder límite:

```json
{
  "error": "PLAN_LIMIT_EXCEEDED",
  "resource": "assets",
  "current": 98,
  "limit": 100,
  "plan": "STARTER",
  "upgrade_to": "PRO"
}
```

#### Respuesta cuando el DEMO expiró:

```json
{
  "error": "DEMO_EXPIRED",
  "expired_at": "2026-07-06T00:00:00Z"
}
```

#### Cron job — `suspendExpiredDemos()`:

Instalar si no está: `npm install @nestjs/schedule`

Agregar `ScheduleModule.forRoot()` en `AppModule.imports[]`.

Decorar el método con:
```typescript
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async suspendExpiredDemos() { ... }
```

### 4.4 SubscriptionsController — endpoints

| Método | Ruta | Descripción | Rol | Body |
|---|---|---|---|---|
| `GET` | `/subscriptions` | Listar todos | SUPER_ADMIN | `?plan=PRO&status=ACTIVE` |
| `GET` | `/subscriptions/me` | Mi plan + uso actual | ADMIN / WORKER | — |
| `POST` | `/subscriptions/:orgId/plan` | Asignar plan a org | SUPER_ADMIN | `{ plan, overrides?, notes? }` |
| `POST` | `/subscriptions/me/request-change` | Solicitar cambio de plan | ADMIN | `{ requested_plan }` |
| `POST` | `/subscriptions/:orgId/approve-change` | Aprobar o rechazar solicitud | SUPER_ADMIN | `{ approved: boolean }` |
| `PATCH` | `/subscriptions/:orgId/status` | Suspender / reactivar | SUPER_ADMIN | `{ status: 'ACTIVE' \| 'SUSPENDED' }` |

### 4.5 Decorator `@CheckPlanLimit()`

Crear `check-plan-limit.decorator.ts`. Internamente extrae `organization_id` del JWT y llama a `subscriptionsService.checkLimit(orgId, resource)`.

**Puntos donde aplicar el decorator:**

```typescript
// AssetsController
@Post()
@CheckPlanLimit('assets')
create(...) { }

// InvitationsController — al invitar usuario interno
@Post()
@CheckPlanLimit('users')
invite(...) { }

// ServicesController — solo verificar DEMO_EXPIRED, servicios no tienen límite numérico
@Post()
@CheckPlanLimit('services')
create(...) { }
```

**Validaciones manuales adicionales** (sin decorator, dentro del método o service):

- **Upload de video** (`ServiceAttachmentsController`): si `mime_type.startsWith('video/')` y `subscription.max_video_hours === 0`, rechazar con `PLAN_LIMIT_EXCEEDED`.
- **Rol EXTERNAL** (`InvitationsController`): si `dto.role === 'EXTERNAL'` y `subscription.allow_external === false`, rechazar.
- **Branding** (`OrganizationsController.updateSettings()`): si se intenta cambiar `brand_color` o logo y `subscription.allow_branding === false`, rechazar.
- **Traducción AI** (`AiSettingsController`): si se intenta activar y `subscription.allow_ai_translation === false`, rechazar.

### 4.6 Integración en `OrganizationsService.create()`

Al crear una org nueva, el subscription DEMO se crea automáticamente:

```typescript
async create(dto: CreateOrganizationDto) {
  const org = await this.prisma.organization.create({ data: { ...dto } });

  // Crear subscription DEMO automáticamente
  await this.subscriptionsService.createForOrganization(org.id, 'DEMO');

  return org;
}
```

Inyectar `SubscriptionsService` en el constructor de `OrganizationsService`.

### 4.7 Sincronización con `Organization.is_active`

Al suspender una org (via `updatePlan` o `suspendExpiredDemos`), además de cambiar `subscription.status = 'SUSPENDED'`, setear `organization.is_active = false` para que los guards existentes sigan funcionando.

Al reactivar, setear `organization.is_active = true`.

### 4.8 `AppModule` — agregar

```typescript
// imports[]
ScheduleModule.forRoot(),
SubscriptionsModule,
```

### 4.9 Seed actualizado

En `backend/prisma/seed.ts`, después de crear cada org del seed, agregar su Subscription en PRO para que el entorno de desarrollo no tenga restricciones:

```typescript
await prisma.subscription.create({
  data: {
    organization_id: org.id,
    plan: 'PRO',
    status: 'ACTIVE',
    max_users: 10,
    max_assets: 500,
    max_storage_gb: 50,
    max_video_hours: 10,
    allow_external: true,
    allow_branding: false,
    allow_ai_translation: true,
  }
});
```

---

## 5. Frontend — Next.js

### 5.1 Nuevo servicio: `subscriptions.service.ts`

**Archivo:** `frontend/src/services/subscriptions.service.ts`

```typescript
export type PlanTier = 'DEMO' | 'STARTER' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
export type SubscriptionStatus = 'ACTIVE' | 'TRIALING' | 'SUSPENDED' | 'CANCELLED';

export interface Subscription {
  id: string;
  organization_id: string;
  plan: PlanTier;
  status: SubscriptionStatus;
  max_users: number;
  max_assets: number;
  max_storage_gb: number;
  max_video_hours: number;
  allow_external: boolean;
  allow_branding: boolean;
  allow_ai_translation: boolean;
  demo_expires_at: string | null;
  pending_plan: PlanTier | null;
  pending_plan_requested_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionWithUsage {
  subscription: Subscription;
  usage: {
    users: number;
    assets: number;
    storage_gb: number;
    video_hours: number;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
  };
}

export const subscriptionsService = {
  // ADMIN / WORKER
  getMyPlan: () =>
    api.get<SubscriptionWithUsage>('/subscriptions/me'),
  requestChange: (plan: PlanTier) =>
    api.post('/subscriptions/me/request-change', { requested_plan: plan }),

  // SUPER_ADMIN
  listAll: (params?: { plan?: PlanTier; status?: SubscriptionStatus }) =>
    api.get<SubscriptionWithUsage[]>('/subscriptions', { params }),
  assignPlan: (orgId: string, data: { plan: PlanTier; overrides?: Partial<Subscription>; notes?: string }) =>
    api.post(`/subscriptions/${orgId}/plan`, data),
  approveChange: (orgId: string, approved: boolean) =>
    api.post(`/subscriptions/${orgId}/approve-change`, { approved }),
  toggleStatus: (orgId: string, status: SubscriptionStatus) =>
    api.patch(`/subscriptions/${orgId}/status`, { status }),
};
```

### 5.2 Vista SUPER_ADMIN — ampliar `/organizations`

**Archivo:** `frontend/src/app/(main)/organizations/page.tsx`

Agregar un segundo `useQuery` para `subscriptionsService.listAll()`. Mergear con la lista de orgs por `organization_id`.

**Columnas nuevas en la tabla:**

- **Plan**: badge con color según tier. `DEMO`=amber, `STARTER`=gris, `PRO`=azul, `BUSINESS`=verde, `ENTERPRISE`=violeta.
- **Estado**: badge `ACTIVE`/`TRIALING`=verde, `SUSPENDED`=rojo, `CANCELLED`=gris.
- **Solicitud pendiente**: icono de campana naranja si `pending_plan !== null`. Tooltip: `"Solicitud de cambio a PRO pendiente"`.
- **Demo vence**: solo si `plan === 'DEMO'`. Fecha en rojo si quedan ≤ 3 días.
- **Acciones**: agregar botón `"Gestionar plan"` que abre `PlanManagementDrawer`.

### 5.3 Nuevo componente: `PlanManagementDrawer`

**Archivo:** `frontend/src/components/subscriptions/PlanManagementDrawer.tsx`

Usar el componente `Drawer` existente. Se abre desde la tabla de orgs. Contiene:

1. **Header**: nombre de la org + badge del plan actual.
2. **Uso actual**: progress bars para usuarios, activos, storage y video (valores reales vs límites).
3. **Cambiar plan**: cards o dropdown para seleccionar entre los 5 planes. Plan actual marcado con check. Al seleccionar uno diferente, mostrar `Cancelar` / `Aplicar`. Si se selecciona `ENTERPRISE`, mostrar inputs para `max_users`, `max_assets`, `max_storage_gb`, `max_video_hours`.
4. **Notas internas**: textarea visible solo en este drawer. No se muestra al ADMIN de la org.
5. **Solicitud pendiente**: si `pending_plan !== null`, mostrar banner con plan solicitado, fecha y botones `Aprobar` / `Rechazar`.
6. **Estado de cuenta**: botones `Suspender` / `Reactivar` con modal de confirmación.

### 5.4 Sección en Settings para el ADMIN

**Archivo:** `frontend/src/app/(main)/settings/page.tsx`

Agregar sección `"Plan y Membresía"` visible solo si `role === 'ADMIN'`. Puede ser un nuevo tab o una sección al final de la página.

#### Componente `PlanStatusCard`

**Archivo:** `frontend/src/components/subscriptions/PlanStatusCard.tsx`

- Nombre del plan con badge de color y precio de referencia (ej. `"PRO — $149/mes"`).
- Si es `DEMO`: barra de progreso de días usados sobre 14. Texto `"Vence el [fecha]"`. Si quedan ≤ 3 días, barra en rojo y texto urgente.
- Métricas de uso con barras de progreso:
  - Usuarios: `X / 10`
  - Activos: `X / 500`
  - Storage: `X.X GB / 50 GB`
  - Video: `X hs / 10 hs` (solo si el plan incluye video)
- Lista de features con ✅ / ❌: acceso externo, branding, traducción AI.
- Botón `"Solicitar cambio de plan"` que abre `PlanUpgradeModal`.
- Si hay `pending_plan`: banner azul `"Tu solicitud de cambio a PRO está siendo procesada"`.

#### Componente `PlanUpgradeModal`

**Archivo:** `frontend/src/components/subscriptions/PlanUpgradeModal.tsx`

- Grid de 4 cards: `STARTER ($49)`, `PRO ($149)`, `BUSINESS ($349)`, `ENTERPRISE (Contactar)`. No mostrar `DEMO` como opción.
- Cada card muestra: precio, límites clave, features incluidas.
- Plan actual marcado con borde destacado y badge `"Plan actual"`.
- Al confirmar un plan diferente, llamar a `subscriptionsService.requestChange(plan)`.
- Mensaje de éxito: `"Tu solicitud de cambio a PRO fue enviada. Nuestro equipo la procesará en las próximas 24 horas."`.
- `ENTERPRISE` muestra: `"Contacta con nuestro equipo para pricing personalizado"` en lugar del botón de confirmación.

> ⚠️ El modal debe mostrar con texto claro: **"Los cambios de plan se procesan manualmente. No se realizará ningún cargo automático."**

### 5.5 Banner global: `AccountStatusBanner`

**Archivo:** `frontend/src/components/subscriptions/AccountStatusBanner.tsx`

Renderizar en `frontend/src/app/(main)/layout.tsx` justo debajo del header/topbar. Solo visible para `ADMIN`.

| Condición | Color | Mensaje |
|---|---|---|
| `status === 'SUSPENDED'` | Rojo | `"Tu cuenta está suspendida. Contacta con soporte para reactivarla."` |
| `plan === 'DEMO'` y quedan ≤ 3 días | Amber | `"Tu periodo de prueba vence en X días. [Actualizar plan]"` |
| `plan === 'DEMO'` y `demo_expires_at < now()` | Rojo | `"Tu periodo de prueba ha vencido. [Actualizar plan]"` |
| `pending_plan !== null` | Azul | `"Tu solicitud de cambio a PRO está en proceso."` |

El link `[Actualizar plan]` abre `PlanUpgradeModal` directamente.

### 5.6 Manejo de errores en `api.ts`

**Archivo:** `frontend/src/lib/api.ts`

En el interceptor de response errors, agregar antes del manejo genérico:

```typescript
if (error.response?.data?.error === 'PLAN_LIMIT_EXCEEDED') {
  const { resource, limit, upgrade_to } = error.response.data;
  const names: Record<string, string> = {
    assets: 'activos',
    users: 'usuarios',
    storage: 'almacenamiento',
    video: 'video',
  };
  showToast(
    `Límite de ${names[resource] ?? resource} alcanzado (${limit}). Actualiza al plan ${upgrade_to} para continuar.`,
    'error'
  );
  return Promise.reject(error);
}

if (error.response?.data?.error === 'DEMO_EXPIRED') {
  showToast(
    'Tu periodo de prueba ha expirado. Contacta con tu administrador.',
    'error'
  );
  return Promise.reject(error);
}
```

---

## 6. Modalidad DEMO

### 6.1 Creación automática

Al crear una `Organization` nueva, el sistema crea automáticamente:

```typescript
{
  plan: 'DEMO',
  status: 'TRIALING',
  demo_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  max_users: 3,
  max_assets: 20,
  max_storage_gb: 1,
  max_video_hours: 0,
  allow_external: false,
  allow_branding: false,
  allow_ai_translation: false,
}
```

### 6.2 Restricciones del plan DEMO

- Máximo 3 usuarios internos (ADMIN + WORKER combinados).
- Máximo 20 activos.
- Máximo 1 GB de storage total.
- No se pueden subir archivos con `mime_type` que empiece en `video/`.
- No se puede invitar usuarios con rol `EXTERNAL`.
- No se puede activar el branding personalizado.
- No se puede activar la traducción AI.
- Al expirar: todas las escrituras devuelven `DEMO_EXPIRED`. Las lecturas siguen funcionando.

### 6.3 Expiración

El cron diario `suspendExpiredDemos()`:
1. Busca `Subscription` con `plan='DEMO'` y `demo_expires_at < now()` y `status IN ('ACTIVE', 'TRIALING')`.
2. Cambia `status = 'SUSPENDED'`.
3. Setea `organization.is_active = false`.

---

## 7. Checklist de implementación

### Backend

- [ ] Agregar enums `PlanTier` y `SubscriptionStatus` en `schema.prisma`
- [ ] Agregar modelo `Subscription` en `schema.prisma`
- [ ] Agregar relación `subscription` en `Organization`
- [ ] `npx prisma migrate dev --name add_subscription_system`
- [ ] `npm install @nestjs/schedule` (si no está)
- [ ] Crear `plan-limits.ts` con constantes de los 5 planes
- [ ] Crear `subscriptions.module.ts`, `.controller.ts`, `.service.ts`
- [ ] Implementar todos los métodos de `SubscriptionsService`
- [ ] Crear `check-plan-limit.decorator.ts`
- [ ] Llamar `createForOrganization()` desde `OrganizationsService.create()`
- [ ] Aplicar `@CheckPlanLimit('assets')` en `AssetsController.create()`
- [ ] Aplicar `@CheckPlanLimit('users')` en `InvitationsController.invite()`
- [ ] Validar `mime_type` de video en upload de `ServiceAttachment`
- [ ] Validar rol `EXTERNAL` contra `allow_external` en `InvitationsController`
- [ ] Validar branding en `OrganizationsController.updateSettings()`
- [ ] Validar `ai_translation` en `AiSettingsController`
- [ ] Implementar cron `suspendExpiredDemos()` con `@Cron`
- [ ] Agregar `ScheduleModule.forRoot()` y `SubscriptionsModule` en `AppModule`
- [ ] Sincronizar `organization.is_active` con `subscription.status`
- [ ] Actualizar `seed.ts` para que cada org tenga su `Subscription`

### Frontend

- [ ] Crear `subscriptions.service.ts`
- [ ] Crear `AccountStatusBanner.tsx` e integrarlo en `(main)/layout.tsx`
- [ ] Crear `PlanStatusCard.tsx`
- [ ] Crear `PlanUpgradeModal.tsx` (con aviso de proceso manual visible)
- [ ] Agregar sección `"Plan y Membresía"` en `settings/page.tsx` (solo `ADMIN`)
- [ ] Ampliar `organizations/page.tsx` con columnas de plan, estado y pending
- [ ] Crear `PlanManagementDrawer.tsx`
- [ ] Agregar manejo de `PLAN_LIMIT_EXCEEDED` y `DEMO_EXPIRED` en `api.ts`

---

## 8. Notas técnicas

### No incluir el plan en el JWT

El JWT contiene solo `userId`, `orgId` y `role`. Los datos del plan se consultan desde la DB en cada operación relevante. Esto garantiza que los límites sean efectivos inmediatamente al cambiar de plan.

### Cache del Subscription

Para reducir consultas a DB, usar `CacheModule` de NestJS con TTL de 60 segundos para `getSubscription(orgId)`. Invalidar el cache al llamar `updatePlan()` o `toggleStatus()`.

### Política de datos al suspender

Al suspender: los datos NO se eliminan. El ADMIN puede consultar (solo lectura) su historial. El SUPER_ADMIN puede reactivar en cualquier momento desde `PlanManagementDrawer`.

### Hoja de ruta v2.0

La próxima iteración integrará Stripe con webhooks para automatizar el ciclo de vida de subscriptions y cobros recurrentes. El campo `payment_status` en el modelo `Subscription` está reservado para eso.

---

*Recall — Especificación técnica v1.0 — Junio 2026*
