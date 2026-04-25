# Recall Backend (NestJS)

Esta es la API central del sistema Recall.

## Documentacion Principal

- [Arquitectura del Sistema](../ARCHITECTURE.md)
- [Contratos API](../API_CONTRACTS.md)
- [README Principal](../README.md)
- [Guia de Inicio](../START_GUIDE.md)

## Configuracion Local Oficial

- Puerto backend: `3001`
- PostgreSQL local: `5433`
- Compose oficial: `backend/docker-compose.yml`

## Setup

1. `npm install`
2. Crear `.env` desde `.env.example`
3. Levantar DB con `docker-compose up -d`
4. Ejecutar `npx prisma generate`
5. Ejecutar `npx prisma migrate dev`
6. Ejecutar `npx prisma db seed`

## Scripts

- `npm run start:dev`: servidor de desarrollo en `http://localhost:3001`
- `npm run db:up`: levanta la DB oficial local desde `backend/docker-compose.yml`
- `npm run test:e2e`: ejecuta pruebas e2e

## Nota

No usar el `docker-compose.yml` de la raiz para el entorno local oficial.
