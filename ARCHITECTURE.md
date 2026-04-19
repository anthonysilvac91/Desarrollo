# Arquitectura del MVP: Recall

Este documento describe la visión técnica, los componentes y las reglas fundamentales que sostienen el MVP de Recall.

## 1. Visión General
Recall es una plataforma SaaS multitenant diseñada para la gestión de mantenimiento de activos (yates, maquinaria, vehículos, etc.). Permite a las empresas operadoras (`Organizations`) registrar servicios realizados por trabajadores y compartirlos con clientes finales.

## 2. Actores y Permisos
El sistema utiliza un modelo de Control de Acceso Basado en Roles (RBAC) con aislamiento por Organización.

| Actor | Descripción | Alcance |
| :--- | :--- | :--- |
| **SUPER_ADMIN** | Administrador Maestro | Control global de Organizaciones. No pertenece a ninguna org. puede crear/suspender tenants. |
| **ADMIN** | Gerente de Organización | Gestión total dentro de su Org: Usuarios, Invitaciones, Assets y Services. |
| **WORKER** | Operario / Técnico | Principal ejecutor. Registra `Services` en la App móvil y consulta historial de `Assets`. |
| **CLIENT** | Dueño / Cliente Final | Usuario consultivo. Solo ve `Assets` vinculados y `Services` marcados como públicos. |

## 3. Stack Tecnológico
- **Frontend Desktop**: Next.js 14+ (App Router), Tailwind CSS, React Query.
- **Frontend Mobile**: Experiencia optimizada bajo la ruta `/app` enfocada en operatividad rápida.
- **Backend**: NestJS (Framework progresivo de Node.js).
- **Base de Datos**: PostgreSQL gestionado mediante Prisma ORM.
- **Almacenamiento (Storage)**:
    - **Desarrollo**: Local (`/uploads`).
    - **Producción**: Supabase Storage (Abstraído mediante `StorageService`).

## 4. Multi-tenancy y Aislamiento
Recall utiliza una arquitectura de **Base de Datos Compartida con Esquema Compartido**. El aislamiento es lógico mediante la columna `organization_id` en todas las tablas críticas.

- **Filtro Global**: El backend aplica guards y filtros en los servicios para asegurar que un `ADMIN` o `WORKER` nunca acceda a datos de otra organización.
- **Visibilidad de Clientes**: Los clientes tienen un segundo nivel de aislamiento donde solo ven `Assets` que tienen un registro explícito en la tabla `ClientAssetAccess`.

## 5. Flujo de Datos Crítico
### Registro de un `Service`
1. El **Worker** abre la ruta `/app/assets/[id]/new-service`.
2. Completa datos y adjunta fotos (Multipart/form-data).
3. El **Backend** procesa las imágenes mediante `StorageService`.
4. Se crea el registro en la DB.
5. Si la organización tiene `auto_publish_services: true`, el **Client** recibe visibilidad inmediata.

## 6. Autenticación y Sesión
- **Mecanismo**: JWT (JSON Web Tokens).
- **Frontend**: El `AuthContext.tsx` es la fuente de verdad. Almacena el token en `localStorage` / `Cookies` y gestiona las redirecciones según el rol.
- **Backend**: `AuthGuard` (Passport JWT) protege los endpoints y extrae el `organization_id` y `role` del payload del token para su uso en la lógica de negocio.

---
[Ir a Contratos API (API_CONTRACTS.md)](API_CONTRACTS.md) | [Volver al README](README.md)
