# Recall — Auditoría SaaS Readiness

> Generado: 2026-05-21 | Última actualización: 2026-05-21  
> Auditor: Claude Code (Sonnet 4.6)  
> Estado del branch: `main` — limpio

---

## ⚡ CONTINUAR AQUÍ — Estado al cierre de sesión 2026-05-21

### Completado en esta sesión
- ✅ **Email service** — `EmailModule` con Resend, templates HTML para reset, verificación e invitaciones (`src/email/`)
- ✅ **Password reset** — `POST /auth/forgot-password` + `POST /auth/reset-password` + páginas frontend `/forgot-password` y `/reset-password`
- ✅ **Registro por invitación** — `POST /auth/register` implementado, página frontend `/register?token=xxx`
- ✅ **Invitation system** — `POST /invitations` + `POST /invitations/validate` activos; modal "Invitar" en página de usuarios
- ✅ **Resend configurado** — API key en `.env` (`RESEND_API_KEY`), dominio `onboarding@resend.dev` para dev (solo envía al email de la cuenta Resend)
- ✅ **Migración aplicada** — `EmailToken`, `email_verified_at` en User, `owner_id` en Invitation

### Próximo bloque — Sprint 1 (seguridad, lo que falta)
Estos tres ítems son los únicos pendientes del Sprint 1 antes de pasar al Sprint 2:

1. ~~**Rate limiting**~~ ✅ COMPLETADO 2026-05-21 — `@nestjs/throttler` 6.5.0 instalado. `ThrottlerGuard` global en `AppModule` (60 req/min default). Límites estrictos: login 5/min, forgot-password 3/min, reset-password 5/min, register 10/min, POST /invitations 10/min. `GET /auth/me` excluido con `@SkipThrottle()`.
2. ~~**Helmet.js**~~ ✅ COMPLETADO 2026-05-21 — `helmet` instalado, `app.use(helmet())` en `src/main.ts` antes del middleware de timing.
3. **Limpiar `.env` del historial git** — Usar BFG Repo-Cleaner + rotar `JWT_SECRET` y `RESEND_API_KEY`. Solo si el repo es público o se va a compartir.

### Sprint 2 — siguiente después de eso
- GitHub Actions: lint → test → build
- Sentry en backend y frontend
- pgBouncer para connection pooling
- Winston structured logging

---

## Resumen Ejecutivo

La base técnica es sólida: multi-tenancy correcto, RBAC bien definido, código TypeScript limpio. El sistema de emails y autenticación ya está completo. Los bloqueadores críticos restantes son rate limiting, CI/CD y monitoreo.

**Veredicto:** MVP funcional con auth completa. Faltan seguridad operacional y pagos para producción comercial.

---

## Stack Técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16.2, React 19, TypeScript, Tailwind CSS 4, React Query, Zod |
| Backend | NestJS 11, Prisma 6.19, PostgreSQL 16, JWT + Passport |
| Email | Resend (configurado, `onboarding@resend.dev` en dev) |
| Storage | Local (dev) / Supabase Storage (prod) |
| Testing | Jest (unit + E2E), Playwright (config sin tests) |
| Infra | Docker Compose (local), sin CI/CD |

---

## BLOQUEADORES CRÍTICOS

### 1. Sin sistema de pagos
- No existe integración con Stripe, Paddle ni similar
- Sin subscription management, billing cycles, ni invoices
- **Acción:** Integrar Stripe — Sprint 3

### ~~2. Sin password reset / recuperación de cuenta~~ ✅ COMPLETADO 2026-05-21
- `POST /auth/forgot-password` y `POST /auth/reset-password` implementados
- Páginas `/forgot-password` y `/reset-password` en frontend
- Token de 15 min, invalidación de tokens anteriores

### ~~3. Sin verificación de email~~ ✅ COMPLETADO 2026-05-21
- Email se verifica automáticamente al registrarse por invitación (`email_verified_at`)
- Resend integrado como proveedor

### 4. `.env` comprometido en el historial git
- `/backend/.env` con JWT_SECRET y credenciales está en el repositorio
- **Acción:** BFG Repo-Cleaner + rotar credenciales (solo urgente si repo es público)

### ~~5. Sin rate limiting~~ ✅ COMPLETADO 2026-05-21
- `ThrottlerGuard` global (60 req/min). Login 5/min, forgot-password 3/min, invitations 10/min.

### 6. Sin CI/CD
- No existe `.github/workflows/`
- **Acción:** GitHub Actions — Sprint 2

### 7. Sin monitoreo de errores en producción
- No hay Sentry ni similar
- **Acción:** Sprint 2

---

## ALTA PRIORIDAD

### Auth y Seguridad

| Problema | Detalle | Estado |
|----------|---------|--------|
| ~~Sin headers HTTP de seguridad~~ | `helmet.js` en `src/main.ts` | ✅ 2026-05-21 |
| JWT expira en 12h | Configurado en `auth.module.ts` con `expiresIn: '12h'` | ✅ OK |
| Sin logout efectivo | No hay blacklist de tokens | Pendiente |
| Dual storage de token | Frontend guarda JWT en `localStorage` Y en `Cookies` | Pendiente |
| Sin 2FA para admins | Cuentas ADMIN/SUPER_ADMIN sin segundo factor | Sprint 4 |

### ~~Invitation System~~ ✅ COMPLETADO 2026-05-21
- `POST /invitations` y `POST /invitations/validate` activos
- Modal "Invitar" en `/users` con selector de rol y owner para EXTERNAL
- Página `/register?token=xxx` funcional

### Connection Pooling
- Sin pgBouncer ni Prisma Data Proxy — Sprint 2

### Compliance Legal (GDPR / CCPA)
- Sin export de datos ni delete account — Sprint 4

### Audit Logs
- Sin tabla `audit_log` — Sprint 4

---

## DEUDA TÉCNICA MEDIA

### Performance
- Dashboard sin cache (Redis pendiente)
- File URL resolution individual por usuario (batch pendiente)
- Sin query logging de Prisma

### Testing
- Playwright sin tests escritos
- Sin coverage threshold en Jest

### Logging
- Sin structured logging JSON (Winston pendiente — Sprint 2)
- Sin request ID correlation

### Configuración y Entorno
- Sin `.env.example` documentado
- Sin validación de env vars al arrancar

---

## Lo que está bien (no tocar)

- **Multi-tenancy:** `organization_id` en todas las queries
- **RBAC:** 4 roles (SUPER_ADMIN / ADMIN / WORKER / EXTERNAL) con guards correctos
- **Email:** Resend integrado con templates HTML en `src/email/email.service.ts`
- **Auth completa:** login, register, forgot-password, reset-password, invitations — todo funcional y probado
- **Abstracción de storage:** local ↔ Supabase sin cambiar lógica de negocio
- **Password hashing:** bcryptjs cost factor 10
- **Paginación:** implementada en assets, services, users, companies
- **Documentación técnica:** ARCHITECTURE.md y API_CONTRACTS.md actualizados

---

## Hoja de Ruta para Cerrar como SaaS

### Sprint 1 — Seguridad y Auth
- [x] Implementar password reset con token por email ✅ 2026-05-21
- [x] Implementar verificación de email en registro ✅ 2026-05-21
- [x] Integrar servicio de email (Resend) ✅ 2026-05-21
- [x] Habilitar invitation system ✅ 2026-05-21
- [x] **Añadir rate limiting con `@nestjs/throttler`** ✅ 2026-05-21
- [x] **Añadir `helmet.js` al backend** ✅ 2026-05-21
- [ ] Limpiar `.env` del historial git y rotar credenciales

### Sprint 2 — Operaciones
- [ ] GitHub Actions: lint → test → build
- [ ] Integrar Sentry en backend y frontend
- [ ] Configurar connection pooling (pgBouncer)
- [ ] Estrategia de backup de PostgreSQL
- [ ] Structured logging con Winston (JSON format)

### Sprint 3 — Monetización
- [ ] Integrar Stripe con Webhooks
- [ ] Definir tiers de suscripción (Free / Pro / Enterprise)
- [ ] Implementar upgrade/downgrade flows en UI
- [ ] Billing portal (Stripe Customer Portal)
- [ ] Metering de storage contra plan

### Sprint 4 — Compliance y Onboarding
- [ ] Endpoints GDPR: export de datos + delete account
- [ ] Acceptance de Terms & Privacy en registro
- [ ] Audit log table + API
- [ ] 2FA para roles ADMIN y SUPER_ADMIN
- [ ] Coverage thresholds en CI
- [ ] Playwright E2E tests para flows críticos

---

## Features SaaS Pendientes (backlog)

| Feature | Impacto | Esfuerzo |
|---------|---------|---------|
| SSO / OAuth (Google, Microsoft) | Alto (enterprise) | Alto |
| Admin impersonation (soporte) | Alto | Medio |
| Notificaciones email (updates de servicios) | Medio | Bajo (Resend ya integrado) |
| Webhooks para integraciones | Medio | Medio |
| Bulk user import (CSV) | Medio | Bajo |
| Feature flags | Medio | Medio |
| Activity timeline por usuario | Bajo | Bajo |
| API keys para terceros | Medio | Medio |

---

*Actualizar este documento al completar cada ítem. Los checks ✅ incluyen fecha de cierre.*
