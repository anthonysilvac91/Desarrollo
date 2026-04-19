# Recall MVP: Gestión de Activos y Mantenimiento

Recall es una solución SaaS multitenant diseñada para centralizar el historial de mantenimiento y servicios de activos físicos (especialmente en el sector náutico y de maquinaria), permitiendo una comunicación fluida entre administradores, trabajadores y clientes.

## 🚀 Documentación Técnica Central

Para entender cómo funciona el sistema a nivel profundo, consulta los siguientes documentos:

- 🏗️ **[Arquitectura del Sistema (ARCHITECTURE.md)](ARCHITECTURE.md)**: Actores, roles, multi-tenancia y flujo de datos.
- 🔌 **[Contratos API (API_CONTRACTS.md)](API_CONTRACTS.md)**: Endpoints, métodos y esquemas de comunicación.

---

## 🛠️ Stack Tecnológico

El proyecto está estructurado como un monorepositorio con dos paquetes principales:

- **Frontend (`/frontend`)**: Next.js 14, Tailwind CSS, TypeScript. Port: `3000`.
- **Backend (`/backend`)**: NestJS, Prisma ORM, PostgreSQL. Port: `3001`.

## 🏃 Guía Rápida de Inicio

### Requisitos
- Node.js 18+
- Docker & Docker-compose (para PostgreSQL local)

### Backend
1. Entra a `/backend`.
2. Copia `.env.example` a `.env` y configura el puerto `5433` para DB.
3. Levanta la DB: `docker-compose up -d`.
4. Instala y migra: `npm install && npx prisma db push`.
5. Inyecta datos demo: `npx prisma db seed`.
6. Corre en dev: `npm run start:dev`.

### Frontend
1. Entra a `/frontend`.
2. Copia `.env.example` a `.env.local`.
3. Instala: `npm install`.
4. Corre en dev: `npm run dev`.

---

## 🔒 Credenciales de Prueba (Seed Realista)
Todas las cuentas de prueba creadas mediante el script de `seed` usan la contraseña: `password123`.

- **Super Admin**: `sys@recall.app`
- **Admin (Oceanic)**: `admin@oceanic.app`
- **Worker (Oceanic)**: `roberto@oceanic.app`
- **Client (Oceanic)**: `owner.a@mail.com`

---
© 2024 Recall Project. MVP enfocado en confiabilidad y robustez.
