# Contratos API: Recall MVP

Este documento detalla los endpoints del backend consumidos por el frontend.

## Informacion Base

- **URL Base dev**: `http://localhost:3001`
- **Content-Type**: `application/json` (excepto subidas de archivos: `multipart/form-data`)
- **Autenticacion**: `Authorization: Bearer <JWT>` en todos los endpoints protegidos
- **Rate limiting**: 60 req/min por defecto. Limites estrictos en auth (login: 5/min, forgot-password: 3/min)

---

## 0. Health — `/health`

| Metodo | Ruta | Acceso | Descripcion |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Publico | Healthcheck. Verifica que el backend y la DB respondan. |

**Respuesta 200 — todo OK:**
```json
{ "status": "ok", "database": "ok", "timestamp": "2026-06-07T00:00:00.000Z" }
```

**Respuesta 503 — DB no disponible:**
```json
{ "status": "error", "database": "error", "timestamp": "2026-06-07T00:00:00.000Z" }
```

---

## 1. Auth — `/auth`

| Metodo | Ruta | Acceso | Descripcion |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Publico | Login. Body: `{ email, password }`. Devuelve JWT. |
| `POST` | `/auth/register` | Publico | Registro via invitacion. Body: `{ token, password, name }`. |
| `POST` | `/auth/forgot-password` | Publico | Envia email de reset. Body: `{ email }`. |
| `POST` | `/auth/reset-password` | Publico | Aplica nueva contrasena. Body: `{ token, password }`. |
| `POST` | `/auth/2fa/login` | Publico | Login con codigo TOTP. Body: `{ tempToken, code }`. |
| `GET` | `/auth/me` | Autenticado | Perfil del usuario + branding de su organization. |
| `GET` | `/auth/sessions` | Autenticado | Lista sesiones activas del usuario (por dispositivo). |
| `Delete` | `/auth/sessions/:id` | Autenticado | Revoca una sesion especifica. |
| `POST` | `/auth/sessions/revoke-others` | Autenticado | Revoca todas las sesiones excepto la actual. |
| `POST` | `/auth/logout` | Autenticado | Cierra la sesion actual. |
| `GET` | `/auth/2fa/status` | Autenticado | Estado de 2FA del usuario. |
| `POST` | `/auth/2fa/setup` | Autenticado | Inicia configuracion de 2FA. Devuelve QR y secret. |
| `POST` | `/auth/2fa/verify-setup` | Autenticado | Confirma configuracion con codigo TOTP. |
| `POST` | `/auth/2fa/disable` | Autenticado | Desactiva 2FA. Body: `{ code }`. |

---

## 2. Organizations — `/organizations`

| Metodo | Ruta | Acceso | Descripcion |
| :--- | :--- | :--- | :--- |
| `GET` | `/organizations` | SUPER_ADMIN | Listado global de tenants. |
| `POST` | `/organizations` | SUPER_ADMIN | Crea una organization. |
| `GET` | `/organizations/me` | Autenticado | Datos de la organization del usuario actual. |
| `GET` | `/organizations/me/storage` | ADMIN | Uso de almacenamiento del tenant. |
| `POST` | `/organizations/me/storage/reconcile` | ADMIN | Reconcilia archivos huerfanos en storage. |
| `PATCH` | `/organizations/:id/status` | SUPER_ADMIN | Activa o desactiva una organization. |
| `PATCH` | `/organizations/settings` | ADMIN | Modifica branding y politicas. `multipart/form-data` (incluye logo). |

Campos editables en `PATCH /organizations/settings`: `name`, `brand_color`, `default_asset_icon`, `show_org_name`, `auto_publish_services`, `worker_edit_policy`, `worker_edit_window_hours`, `worker_restricted_access`.

---

## 3. Invitations — `/invitations`

| Metodo | Ruta | Acceso | Descripcion |
| :--- | :--- | :--- | :--- |
| `POST` | `/invitations` | ADMIN / SUPER_ADMIN | Crea y envia invitacion por email. Body: `{ email, role, owner_id? }`. `owner_id` obligatorio para rol `EXTERNAL`. |
| `POST` | `/invitations/validate` | Publico | Valida un token de invitacion. Body: `{ token }`. |

---

## 4. Owners — `/owners`

Entidad que representa la empresa cliente dentro de un tenant. Cada `Asset` pertenece a un `Owner`.

| Metodo | Ruta | Acceso | Descripcion |
| :--- | :--- | :--- | :--- |
| `GET` | `/owners` | ADMIN / EXTERNAL | Lista owners del tenant. EXTERNAL solo ve el suyo. |
| `POST` | `/owners` | ADMIN | Crea un owner. |
| `GET` | `/owners/:id` | ADMIN | Detalle del owner con assets y usuarios asociados. |
| `PATCH` | `/owners/:id` | ADMIN | Actualiza datos del owner. `multipart/form-data` (incluye logo). |
| `PATCH` | `/owners/:id/status` | ADMIN | Activa o desactiva un owner. |
| `DELETE` | `/owners/:id` | ADMIN | Baja logica del owner. |

---

## 5. Assets — `/assets`

| Metodo | Ruta | Acceso | Descripcion |
| :--- | :--- | :--- | :--- |
| `GET` | `/assets` | ADMIN / WORKER / EXTERNAL | Lista activos. EXTERNAL: solo los de su owner. WORKER: todos los activos activos del tenant. |
| `POST` | `/assets` | ADMIN / WORKER | Crea un activo. `multipart/form-data` (incluye thumbnail). |
| `GET` | `/assets/stats` | ADMIN / WORKER / EXTERNAL | Conteos de activos segun rol. |
| `GET` | `/assets/:id` | ADMIN / WORKER / EXTERNAL | Detalle del activo + historial de services. |
| `PATCH` | `/assets/:id` | ADMIN / WORKER | Actualiza activo. WORKER solo puede actualizar el thumbnail. `multipart/form-data`. |
| `PATCH` | `/assets/:id/status` | ADMIN | Activa o desactiva el activo (soft). |
| `DELETE` | `/assets/:id` | ADMIN | Baja logica del activo. |
| `POST` | `/assets/:id/owners/:ownerId` | ADMIN | Vincula un owner al activo. |
| `DELETE` | `/assets/:id/owners/:ownerId` | ADMIN | Desvincula un owner del activo. |

---

## 6. Services — `/services`

| Metodo | Ruta | Acceso | Descripcion |
| :--- | :--- | :--- | :--- |
| `POST` | `/services` | ADMIN / WORKER | Registra un service. `multipart/form-data` (incluye adjuntos de imagen). |
| `GET` | `/services` | Todos | Lista services. EXTERNAL: solo publicos y completados de su owner. |
| `GET` | `/services/stats` | ADMIN / WORKER | Estadisticas de services del tenant o del worker. |
| `GET` | `/services/:id` | Todos | Detalle del service con adjuntos. |
| `PATCH` | `/services/:id` | ADMIN / WORKER | Edita `title`, `description`, `status`, `is_public`. WORKER sujeto a `worker_edit_policy`. |
| `DELETE` | `/services/:id` | ADMIN | Elimina el service (fisico). |

---

## 7. Users — `/users`

| Metodo | Ruta | Acceso | Descripcion |
| :--- | :--- | :--- | :--- |
| `GET` | `/users/stats` | ADMIN / SUPER_ADMIN | Conteos de usuarios por rol en el tenant. |
| `GET` | `/users` | ADMIN / SUPER_ADMIN | Lista usuarios del tenant. |
| `POST` | `/users` | ADMIN / SUPER_ADMIN | Crea usuario manualmente. SUPER_ADMIN puede indicar `organization_id`. |
| `PATCH` | `/users/me` | Autenticado | Actualiza perfil propio (nombre, email, telefono, avatar). `multipart/form-data`. |
| `PATCH` | `/users/:id` | ADMIN / SUPER_ADMIN | Actualiza datos de otro usuario. |
| `PATCH` | `/users/:id/status` | ADMIN / SUPER_ADMIN | Activa o desactiva un usuario. |
| `GET` | `/users/:id` | ADMIN / SUPER_ADMIN | Detalle de un usuario. |

Validaciones en `POST /users`:
- `email` globalmente unico en toda la plataforma.
- `password` minimo 8 caracteres.
- `role` valido: `SUPER_ADMIN`, `ADMIN`, `WORKER`, `EXTERNAL`.
- `EXTERNAL` requiere `owner_id` valido y activo dentro de la misma organization.
- `ADMIN` y `WORKER` no aceptan `owner_id`.

---

## 8. Dashboard — `/dashboard`

| Metodo | Ruta | Acceso | Descripcion |
| :--- | :--- | :--- | :--- |
| `GET` | `/dashboard` | ADMIN / WORKER / EXTERNAL / SUPER_ADMIN | KPIs, evolucion 7 dias, top assets, top workers. WORKER: filtrado a sus propios services. EXTERNAL: filtrado a assets de su owner. |

Query params opcionales: `startDate`, `endDate`, `organizationId` (solo SUPER_ADMIN).

---

## Manejo de Errores

Todas las respuestas de error (4xx, 5xx) siguen este esquema:

```json
{
  "statusCode": 401,
  "timestamp": "2024-04-19T...",
  "path": "/auth/me",
  "message": "Mensaje legible de error"
}
```

---

[Ir a Arquitectura](ARCHITECTURE.md) | [Volver al README](README.md)
