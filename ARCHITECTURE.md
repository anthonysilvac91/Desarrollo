# Arquitectura del MVP: Recall

Este documento describe la vision tecnica, los componentes y las reglas fundamentales del MVP de Recall.

## 1. Vision General
Recall es una plataforma SaaS multitenant para la gestion de mantenimiento de activos. `Organization` es el tenant raiz. Cada organization administra su equipo interno y sus `Companies`, que representan empresas cliente a las que se asocian usuarios y activos.

## 2. Actores y Permisos
El sistema usa un modelo RBAC con aislamiento por organization.

| Actor | Descripcion | Alcance |
| :--- | :--- | :--- |
| **SUPER_ADMIN** | Administrador maestro | Control global de organizations. No pertenece a ninguna org y puede crear o suspender tenants. |
| **ADMIN** | Gerente de organization | Gestion total dentro de su org: usuarios, invitaciones, companies, assets y services. |
| **WORKER** | Operario / tecnico | Principal ejecutor. Registra `Services` en la app operativa y consulta historial de `Assets`. |
| **CLIENT** | Usuario de company | Persona asociada a una `Company`. Solo ve `Assets` vinculados a su company y `Services` marcados como publicos. |

## 3. Stack Tecnologico
- **Frontend Desktop**: Next.js (App Router), Tailwind CSS, React Query
- **Frontend Mobile**: experiencia optimizada bajo la ruta `/app`
- **Backend**: NestJS
- **Base de Datos**: PostgreSQL gestionado mediante Prisma ORM
- **Storage**:
  - **Desarrollo**: local (`/uploads`)
  - **Produccion**: Supabase Storage mediante `StorageService`
  - **Importante**: `STORAGE_TYPE=local` es solo para desarrollo. En ese modo los archivos quedan expuestos via `/uploads`, por lo que no garantiza privacidad ni aislamiento fuerte para media multi-tenant.

## 4. Multi-tenancy y Aislamiento
Recall utiliza una arquitectura de base de datos compartida con esquema compartido. El aislamiento es logico mediante la columna `organization_id` en las tablas criticas.

- **Filtro global**: el backend aplica guards y filtros para asegurar que un `ADMIN` o `WORKER` nunca acceda a datos de otra organization.
- **Companies**: la entidad persistida hoy sigue llamandose `Customer`, pero a nivel de dominio representa una `Company`.
- **Usuarios externos**: el rol `CLIENT` se mantiene por compatibilidad tecnica, pero conceptualmente representa a un usuario asociado a una `Company`.
- **Visibilidad de usuarios de company**: los usuarios externos solo ven `Assets` y `Services` asociados a su company.

## 5. Flujo de Datos Critico
### Registro de un `Service`
1. El **Worker** abre la ruta `/app/assets/[id]/new-service`.
2. Completa datos y adjunta fotos (`multipart/form-data`).
3. El **Backend** procesa las imagenes mediante `StorageService`.
4. Se crea el registro en la DB.
5. Si la organization tiene `auto_publish_services: true`, el usuario de la **Company** recibe visibilidad inmediata.

## 6. Autenticacion y Sesion
- **Mecanismo**: JWT
- **Frontend**: `AuthContext.tsx` es la fuente de verdad. Almacena token en `localStorage` / cookies y gestiona redirecciones segun el rol.
- **Backend**: `AuthGuard` protege endpoints y extrae `organization_id`, `role` y `customer_id` del token para la logica de negocio.

---
[Ir a Contratos API (API_CONTRACTS.md)](API_CONTRACTS.md) | [Volver al README](README.md)
