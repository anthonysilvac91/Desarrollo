# Recall MVP: Gestion de Activos y Mantenimiento

Recall es una solucion SaaS multitenant para centralizar el historial de mantenimiento y servicios de activos fisicos, con una configuracion local oficial unica y consistente.

## Documentacion Tecnica Central

Para entender el sistema en detalle:

- **[Arquitectura del Sistema](ARCHITECTURE.md)**: actores, roles, multi-tenencia y flujo de datos.
- **[Contratos API](API_CONTRACTS.md)**: endpoints, metodos y esquemas.
- **[Guia de Inicio](START_GUIDE.md)**: arranque local oficial.

## Stack Tecnologico

El proyecto esta estructurado como monorepo:

- **Frontend (`/frontend`)**: Next.js, React, TypeScript, Tailwind CSS. Puerto oficial local: `3000`.
- **Backend (`/backend`)**: NestJS, Prisma ORM, PostgreSQL. Puerto oficial local: `3001`.
- **Base de datos local**: PostgreSQL via Docker Compose en `backend/docker-compose.yml`, expuesto en `5433`.

## Configuracion Local Oficial

La unica configuracion local soportada oficialmente es:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- API del frontend: `NEXT_PUBLIC_API_URL=http://localhost:3001`
- PostgreSQL: `localhost:5433`
- Compose oficial de DB: `backend/docker-compose.yml`

## Guia Rapida de Inicio

### Requisitos

- Node.js 18+
- Docker Desktop o Docker Engine con Compose

### Base de datos

1. Entra a `backend/`.
2. Copia `.env.example` a `.env`.
3. Levanta Postgres con el compose oficial:
   `docker-compose up -d`

### Backend

1. Entra a `backend/`.
2. Instala dependencias:
   `npm install`
3. Genera Prisma Client:
   `npx prisma generate`
4. Aplica migraciones:
   `npx prisma migrate dev`
5. Carga datos demo:
   `npx prisma db seed`
6. Inicia el backend:
   `npm run start:dev`

### Frontend

1. Entra a `frontend/`.
2. Copia `.env.example` a `.env.local`.
3. Instala dependencias:
   `npm install`
4. Inicia el frontend:
   `npm run dev`

## Credenciales de Prueba

Todas las cuentas creadas por `seed` usan la contrasena `password123`.

- **Super Admin**: `sys@recall.app`
- **Admin (Oceanic)**: `admin@oceanic.app`
- **Worker (Oceanic)**: `roberto@oceanic.app`
- **Cliente Charter**: `gestor.charter@mail.com`
- **Cliente Owners**: `propietario@mail.com`

## Nota Legacy

El archivo `docker-compose.yml` en la raiz queda marcado como legacy. Para entorno local usa solo `backend/docker-compose.yml`.
