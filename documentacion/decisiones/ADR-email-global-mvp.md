# ADR-001: Email único global para MVP

**Fecha:** 2026-06-07
**Estado:** Aceptado
**Autor:** Anthony Silva

---

## Contexto

Recall es un SaaS multi-tenant. Cada usuario pertenece a una organización (`organization_id`). La pregunta arquitectónica es si el email debe ser único a nivel global (un email = una cuenta en todo Recall) o único por tenant (un email puede existir en múltiples organizaciones).

Durante el desarrollo del MVP surgió una ambigüedad: la DB tiene `User.email @unique` (global), pero algunas validaciones en el código verifican duplicados solo dentro de la misma organización, con mensajes y comentarios que sugieren email por-tenant. Esto generó inconsistencias documentadas en la sección de hallazgos.

---

## Decisión

**Para el MVP, el email es único globalmente en Recall.**

Un email corresponde a una sola cuenta. Una cuenta pertenece a una sola organización. No se permite que el mismo email exista en múltiples tenants.

---

## Fundamentos

- La constraint `User.email @unique` en Prisma ya lo impone a nivel de base de datos. Cambiarla requeriría una migración y rediseño de login, forgot-password y 2FA.
- El flujo de login (`auth.service.ts:278`) busca el usuario solo por email, sin `organization_id`. Un login por email+tenant requeriría cambios en el formulario y en el JWT.
- El forgot-password (`auth.service.ts:565`) busca por email global. Añadir org context requeriría que el usuario sepa a qué org pertenece antes de recuperar su contraseña.
- El 2FA y las sesiones están atadas al `user.id`, que es una entidad global.
- El registro vía invitación (`auth.service.ts:400`) verifica `user.findUnique({ where: { email } })` sin org. Un email ya registrado en cualquier org no puede aceptar otra invitación.

---

## Consecuencias

### Lo que se gana
- Login simple: el usuario solo necesita saber su email, no su org.
- Forgot-password sin selección de org.
- 2FA asociado a una identidad, no a una sesión de org.
- Sesiones de dispositivo únicas por usuario (el panel de seguridad muestra todos los dispositivos independientemente de la org).
- Sin duplicación de usuarios en la DB ni sesiones paralelas con identidades distintas.

### Lo que se limita
- Una persona no puede tener cuentas separadas en múltiples organizaciones de Recall con el mismo email. Si lo necesita, debe usar un email diferente.
- Un usuario que abandona una org no puede ser invitado a otra con el mismo email sin que el SUPER_ADMIN elimine o desactive la cuenta anterior.
- No se puede modelar el caso "consultor que trabaja para múltiples clientes de Recall" con un solo email.

### Cuándo reconsiderar (email por-tenant)
- Si Recall necesita permitir que una persona sea miembro activo de múltiples organizaciones simultáneamente.
- Si aparece un caso de negocio concreto donde el mismo email opera con roles distintos en orgs distintas.
- Si se introduce SSO/SAML, donde la identidad externa ya gestiona la unicidad por proveedor y Recall solo necesita vincular el token externo.

En ese momento, la migración requeriría: cambiar `@unique` en email a `@@unique([email, organization_id])`, rediseñar el login para pedir org o detectarla por dominio, rediseñar forgot-password, aislar las sesiones por `(user_id, organization_id)`, y decidir qué hacer con los tokens 2FA existentes.

---

## Impacto por flujo

| Flujo | Comportamiento actual | Consistente con decisión |
|---|---|---|
| Login | `findFirst({ where: { email } })` sin org | ✅ Global por diseño |
| Registro vía invitación | `findUnique({ where: { email } })` — bloquea si existe en cualquier org | ✅ Global |
| Forgot password | `findFirst({ where: { email, is_active: true } })` sin org | ✅ Global |
| Cambio de email | `findFirst({ where: { email, id: { not: userId } } })` sin org | ✅ Global |
| 2FA | Asociado a `user.id` global | ✅ Global |
| Sesiones | `UserSession.user_id` → FK a User global | ✅ Global |
| DB constraint | `User.email @unique` | ✅ Global forzado a nivel de DB |

---

## Inconsistencias encontradas en el código (no bloquean seguridad)

Estas inconsistencias no causan vulnerabilidades (la constraint de DB actúa como red de seguridad), pero generan mensajes de error confusos y código contradictorio con esta decisión. Se documentan aquí para corregirlos en un refactor futuro.

### 1. `users.service.ts:287` — Verificación de duplicado por-tenant en createUser

```typescript
// Comentario: "Verificar email duplicado en el mismo tenant"
const existingUser = await this.prisma.user.findFirst({
  where: {
    email: dto.email,
    organization_id: dto.organization_id || null  // ← busca solo en esta org
  }
});
if (existingUser) {
  throw new ConflictException('El correo ya está registrado en esta organización'); // ← mensaje incorrecto
}
```

**Problema:** Si `user@example.com` ya existe en la org A y SUPER_ADMIN intenta crearlo en la org B:
1. El `findFirst` con `organization_id: orgB` no encuentra nada → la validación pasa.
2. `prisma.user.create` lanza `P2002` (unique constraint violated en email).
3. El error llega como 500 no controlado en lugar de un 409 con mensaje claro.

**Corrección sugerida (sin cambio de schema):** Cambiar la query a `findUnique({ where: { email: dto.email } })` y el mensaje a `'El correo ya está registrado en Recall'`.

### 2. `invitations.service.ts:53` — Verificación de usuario existente por-tenant

```typescript
const existingUser = await this.prisma.user.findFirst({
  where: { email: dto.email, organization_id: organizationId }, // ← solo en esta org
});
if (existingUser) {
  throw new BadRequestException('Ya existe un usuario con este correo en la organización');
}
```

**Problema:** Si `user@example.com` existe en la org A, esta validación no lo detecta cuando se invite desde la org B. La invitación se crea y se envía el email. Cuando el usuario intenta registrarse, `auth.service.ts:400` detecta el email globalmente y lanza `'Ya existe una cuenta con este correo'`. El usuario recibe un email de invitación pero no puede registrarse.

**Corrección sugerida:** Cambiar a `findUnique({ where: { email: dto.email } })` para detectar el conflicto antes de enviar el email.

### 3. `Invitation` model — Índice `@@index([email, organization_id])`

Este índice sugiere un diseño orientado a email por-tenant (lo usaría una constraint `@@unique([email, organization_id])`). Para email global, el índice es útil para la búsqueda de invitaciones duplicadas dentro de una org (que sí es válido), así que puede mantenerse. No representa una inconsistencia de seguridad.

---

## Archivos revisados para este análisis

| Archivo | Email global | Notas |
|---|---|---|
| `backend/prisma/schema.prisma:90` | ✅ `@unique` en User.email | DB enforces global uniqueness |
| `backend/src/auth/auth.service.ts:278` | ✅ | Login por email sin org |
| `backend/src/auth/auth.service.ts:400` | ✅ | Register bloquea email global |
| `backend/src/auth/auth.service.ts:565` | ✅ | Forgot password busca email global |
| `backend/src/users/users.service.ts:287-296` | ⚠️ | Check por-tenant + mensaje incorrecto |
| `backend/src/users/users.service.ts:525-536` | ✅ | Email change busca globalmente |
| `backend/src/invitations/invitations.service.ts:53` | ⚠️ | Check por-tenant en validación de invitación |
| `backend/prisma/schema.prisma:311` | ℹ️ | `@@index([email, organization_id])` en Invitation — no inconsistencia |

---

## Acciones pendientes (sin urgencia para MVP)

| Prioridad | Acción | Archivo | Impacto |
|---|---|---|---|
| Media | Cambiar `findFirst(email + org_id)` → `findUnique(email)` en createUser | `users.service.ts:288` | Previene 500 silencioso al crear usuario con email duplicado en otra org |
| Media | Cambiar validación de usuario existente en invite a global | `invitations.service.ts:53` | Evita enviar email de invitación que el receptor no puede usar |
| Baja | Actualizar mensaje de error en createUser | `users.service.ts:296` | UX: "en esta organización" → "en Recall" |
| Baja | Actualizar comentario en createUser | `users.service.ts:287` | Eliminar "en el mismo tenant" |
