# Contratos API: Recall MVP

Este documento detalla los endpoints principales consumidos por el Frontend y las reglas de comunicación con el Backend.

## Información Base
- **URL Base**: `http://localhost:3001` (Dev)
- **Content-Type**: `application/json` (Excepto subidas de archivos)
- **Autenticación**: Bearer Token (JWT) en el header `Authorization`.

---

## 1. Módulo: Auth
| Método | Ruta | Rol | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Público | Login. Req: `{email, password, organizationId?}`. |
| `POST` | `/auth/register` | Público | Registro vía invitación. Req: `{token, password, name}`. |
| `GET` | `/auth/me` | Todos | Retorna perfil de usuario y branding de su organización. |

## 2. Módulo: Organizations (Multi-tenant)
| Método | Ruta | Rol | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/organizations` | SUPER_ADMIN | Listado global de tenants. |
| `POST` | `/organizations` | SUPER_ADMIN | Crea Org e invita al primer Admin. |
| `PATCH` | `/organizations/:id/status` | SUPER_ADMIN | Activar/Desactivar organización. |
| `PATCH` | `/organizations/settings` | ADMIN | Modifica branding y políticas de la Org. |

## 3. Módulo: Invitations
| Método | Ruta | Rol | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/invitations` | ADMIN / S.A. | Crea una invitación para un nuevo usuario. |
| `POST` | `/invitations/validate` | Público | Valida si un token es válido antes de registrar. |

## 4. Módulo: Assets (Activos)
| Método | Ruta | Rol | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/assets` | Todos | Lista activos según rol (Admin/Worker: todos; Client: vinculados). |
| `POST` | `/assets` | ADMIN / WORKER | Crea un activo. |
| `GET` | `/assets/:id` | Todos | Detalle del activo + historial de servicios. |
| `POST` | `/assets/:id/clients/:clientId` | ADMIN | Vincula un cliente al activo. |

## 5. Módulo: Services (Intervenciones)
| Método | Ruta | Rol | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/services` | WORKER / ADMIN | Registro de servicio. **Content-Type: multipart/form-data**. |
| `GET` | `/services` | Todos | Lista servicios. Filtra privados si el rol es CLIENT. |
| `PATCH` | `/services/:id` | ADMIN | Edita datos, estatus o visibilidad pública del servicio. |

## 6. Módulo: Dashboard & Users
| Método | Ruta | Rol | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/dashboard` | ADMIN / S.A. | Estadísticas (KPIs) de la organización o globales. |
| `GET` | `/users` | ADMIN / S.A. | Listado de equipo/usuarios según tenant. |

---

## Manejo de Errores Unificado
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
[Ir a Arquitectura (ARCHITECTURE.md)](ARCHITECTURE.md) | [Volver al README](README.md)
