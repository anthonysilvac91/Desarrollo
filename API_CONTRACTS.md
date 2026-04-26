# Contratos API: Recall MVP

Este documento detalla los endpoints principales consumidos por el frontend y las reglas de comunicacion con el backend.

## Informacion Base
- **URL Base**: `http://localhost:3001` (dev)
- **Content-Type**: `application/json` (excepto subidas de archivos)
- **Autenticacion**: Bearer Token (JWT) en el header `Authorization`

---

## 1. Modulo: Auth
| Metodo | Ruta | Rol | Descripcion |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Publico | Login. Req: `{email, password, organizationId?}`. |
| `POST` | `/auth/register` | Publico | Registro via invitacion. Req: `{token, password, name}`. |
| `GET` | `/auth/me` | Todos | Retorna perfil del usuario y branding de su organization. |

## 2. Modulo: Organizations
| Metodo | Ruta | Rol | Descripcion |
| :--- | :--- | :--- | :--- |
| `GET` | `/organizations` | SUPER_ADMIN | Listado global de tenants. |
| `POST` | `/organizations` | SUPER_ADMIN | Crea una organization e invita al primer admin. |
| `PATCH` | `/organizations/:id/status` | SUPER_ADMIN | Activa o desactiva una organization. |
| `PATCH` | `/organizations/settings` | ADMIN | Modifica branding y politicas de la organization. |

## 3. Modulo: Invitations
| Metodo | Ruta | Rol | Descripcion |
| :--- | :--- | :--- | :--- |
| `POST` | `/invitations` | ADMIN / SUPER_ADMIN | Crea una invitacion para un nuevo usuario. |
| `POST` | `/invitations/validate` | Publico | Valida si un token es valido antes de registrar. |

## 4. Modulo: Companies
| Metodo | Ruta | Rol | Descripcion |
| :--- | :--- | :--- | :--- |
| `GET` | `/companies` | ADMIN | Listado oficial de companies del tenant. |
| `POST` | `/companies` | ADMIN | Crea una company dentro de la organization. |
| `GET` | `/companies/:id` | ADMIN | Detalle de una company con usuarios y activos asociados. |
| `PATCH` | `/companies/:id` | ADMIN | Actualiza una company. |
| `DELETE` | `/companies/:id` | ADMIN | Baja logica de una company. |

## 4.1. Modulo: Customers (Legacy)
| Metodo | Ruta | Rol | Descripcion |
| :--- | :--- | :--- | :--- |
| `GET` | `/customers` | ADMIN | Alias legacy de `/companies`. |
| `POST` | `/customers` | ADMIN | Alias legacy de `/companies`. |
| `GET` | `/customers/:id` | ADMIN | Alias legacy de `/companies/:id`. |
| `PATCH` | `/customers/:id` | ADMIN | Alias legacy de `/companies/:id`. |
| `DELETE` | `/customers/:id` | ADMIN | Alias legacy de `/companies/:id`. |

## 5. Modulo: Assets
| Metodo | Ruta | Rol | Descripcion |
| :--- | :--- | :--- | :--- |
| `GET` | `/assets` | Todos | Lista activos segun rol (Admin/Worker: todos; Client: vinculados a su company). |
| `POST` | `/assets` | ADMIN / WORKER | Crea un activo. |
| `GET` | `/assets/:id` | Todos | Detalle del activo + historial de servicios. |
| `POST` | `/assets/:id/clients/:clientId` | ADMIN | Alias legacy para vincular una `Company` al activo. |

## 6. Modulo: Services
| Metodo | Ruta | Rol | Descripcion |
| :--- | :--- | :--- | :--- |
| `POST` | `/services` | WORKER / ADMIN | Registro de servicio. **Content-Type: multipart/form-data**. |
| `GET` | `/services` | Todos | Lista servicios. Filtra privados si el rol es CLIENT (usuario asociado a una company). |
| `PATCH` | `/services/:id` | ADMIN | Edita datos, estatus o visibilidad publica del servicio. |

## 7. Modulo: Dashboard & Users
| Metodo | Ruta | Rol | Descripcion |
| :--- | :--- | :--- | :--- |
| `GET` | `/dashboard` | ADMIN / SUPER_ADMIN | Estadisticas (KPIs) de la organization o globales. |
| `GET` | `/users` | ADMIN / SUPER_ADMIN | Listado de equipo y usuarios segun tenant. |

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
