# Arquitectura Backend: Recall MVP (Ajustada)

Este documento define la estructura técnica del backend en NestJS y Prisma, consolidando las correcciones de modelado de producto solicitadas.

## 1. Schema Prisma (Ajustado)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  ADMIN
  WORKER
  CLIENT
}

enum JobStatus {
  COMPLETED
  ARCHIVED
}

enum WorkerEditPolicy {
  ALWAYS_OPEN
  UNTIL_ADMIN_INTERVENES
  UNTIL_PUBLISHED
  TIME_WINDOW
}

model Organization {
  id                        String   @id @default(uuid())
  name                      String
  is_active                 Boolean  @default(true)
  
  // Configuraciones del negocio
  auto_publish_jobs         Boolean  @default(true)
  worker_edit_policy        WorkerEditPolicy @default(TIME_WINDOW)
  worker_edit_window_hours  Int?     // Sin default forzado. Aplica solo si policy es TIME_WINDOW

  created_at                DateTime @default(now())
  updated_at                DateTime @updatedAt

  users                     User[]
  assets                    Asset[]
  jobs                      Job[]    // Relación global multi-tenant
}

model User {
  id               String   @id @default(uuid())
  organization_id  String
  role             Role
  email            String
  password_hash    String
  name             String
  is_active        Boolean  @default(true)

  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt

  organization     Organization @relation(fields: [organization_id], references: [id])
  
  jobs_created     Job[]    @relation("JobWorker")
  asset_access     ClientAssetAccess[] @relation("GrantedToClient")
  access_granted   ClientAssetAccess[] @relation("GrantedByAdmin") 
  
  @@unique([email, organization_id]) // Unicidad por Tenant, NO global
  @@index([organization_id])
}

model Asset {
  id               String   @id @default(uuid())
  organization_id  String
  name             String
  description      String?
  is_active        Boolean  @default(true)

  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt

  organization     Organization @relation(fields: [organization_id], references: [id])
  jobs             Job[]
  client_access    ClientAssetAccess[]

  @@index([organization_id])
}

model ClientAssetAccess {
  client_id        String
  asset_id         String
  granted_by_id    String?   

  created_at       DateTime @default(now())

  client           User   @relation("GrantedToClient", fields: [client_id], references: [id])
  asset            Asset  @relation(fields: [asset_id], references: [id])
  granted_by       User?  @relation("GrantedByAdmin", fields: [granted_by_id], references: [id])

  @@id([client_id, asset_id])
  @@index([asset_id])
  @@index([client_id])
}

model Job {
  id               String   @id @default(uuid())
  organization_id  String   // Clave para seguridad y filtros transversales
  asset_id         String
  worker_id        String
  
  title            String
  description      String?
  
  status           JobStatus @default(COMPLETED)
  is_public        Boolean   // Sin @default en base de datos.
  admin_intervened Boolean   @default(false)
  
  created_at       DateTime  @default(now())
  updated_at       DateTime  @updatedAt

  organization     Organization @relation(fields: [organization_id], references: [id])
  asset            Asset     @relation(fields: [asset_id], references: [id])
  worker           User      @relation("JobWorker", fields: [worker_id], references: [id])
  attachments      JobAttachment[]

  @@index([organization_id])
  @@index([asset_id])
  @@index([worker_id])
}

model JobAttachment {
  id               String   @id @default(uuid())
  job_id           String
  file_url         String
  file_type        String?

  created_at       DateTime @default(now())

  job              Job      @relation(fields: [job_id], references: [id])
  
  @@index([job_id])
}
```

## 2. Reglas Backend Afectadas

1.  **Resolución de Login (Transversal):** Dado que el `email` ya no es único globalmente, el `POST /auth/login` requerirá recibir el `organization_id` o un identificador de tenant para emparejar inequívocamente al `User` válido (`where: { email, organization_id }`).
2.  **Visibilidad en Creación (Job):** El DTO de entrada `CreateJobDto` del operario no recibe `is_public`. El backend lo debe inferir al 100% leyendo la respectiva `Organization.auto_publish_jobs`. El backend ahora pasará tanto `organization_id` (vía JWT) como el `is_public` asignado en el `prisma.job.create()`.
3.  **Regla de Edición de Activos (Mecánica Cero-Ambigüedad):** Dado que `Asset` no tiene autor (ni debe tenerlo para no engordar la tabla con metadata inoperante), la regla final del MVP es: **El WORKER solo puede LEER y CREAR un Activo**. La actualización (`PATCH /assets/:id`) queda restringida operativamente solo al ADMIN. Esto mantiene el flujo ágil en campo pero el orden intacto arriba, previniendo renombres destructivos. 
4.  **Multi-Tenant Firme en Jobs:** En `JobsService`, al buscar, listar o buscar histórico, usar el `organization_id` (ahora nativo de tabla) alivia dependencias de sub-joins (agiliza queries).

## 3. Endpoints Afectados 

1. `POST /auth/login`
   -  **Antes:** `{ email, password }`
   -  **Ahora:** `{ email, password, organizationId }` 

2. `PATCH /assets/:id`
   -  **Antes:** Accesible por creador o Admin.
   -  **Ahora:** Estrictamente protegido por `@Roles(Role.ADMIN)`. Solo permitimos listados (`GET`) y creaciones (`POST`) al Operario. El Operario gana agilidad, pero el control ortográfico u organización nominal final es labor directiva.
