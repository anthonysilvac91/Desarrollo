# Guia de Inicio Local Oficial

Esta guia define la unica configuracion local oficial del proyecto.

## Requisitos Previos

- **Node.js**: 18 o superior.
- **Docker**: para PostgreSQL local.
- **Editor**: cualquiera con soporte TypeScript.

## Configuracion Oficial

- **Frontend**: `http://localhost:3000`
- **Backend**: `http://localhost:3001`
- **PostgreSQL**: `localhost:5433`
- **Compose oficial de DB**: `backend/docker-compose.yml`
- **API del frontend**: `NEXT_PUBLIC_API_URL=http://localhost:3001`

Importante:
- `STORAGE_TYPE=local` es solo para desarrollo.
- Cuando esta activo, los archivos quedan expuestos por `/uploads` y no debe considerarse un modo privado.

## Paso 1: Base de Datos

Desde `backend/`:

```bash
docker-compose up -d
```

Eso levanta PostgreSQL local en `localhost:5433`.

## Paso 2: Backend

Desde `backend/`:

```bash
copy .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

El backend queda disponible en `http://localhost:3001`.

## Paso 3: Frontend

Desde `frontend/`:

```bash
copy .env.example .env.local
npm install
npm run dev
```

El frontend queda disponible en `http://localhost:3000`.

## Paso 4: Validacion de Login

Con ambos servidores arriba, abre `http://localhost:3000/login` y valida:

### 1. Acceso Maestro

- **Usuario**: `sys@recall.app`
- **Pass**: `password123`
- **Resultado esperado**: redireccion a `/master`

### 2. Acceso Administrador

- **Usuario**: `admin@oceanic.app`
- **Pass**: `password123`
- **Resultado esperado**: redireccion a `/dashboard`

### 3. Worker

- **Usuario**: `roberto@oceanic.app`
- **Pass**: `password123`
- **Desktop**: redireccion a `/assets`
- **Movil**: redireccion a `/app`

### 4. Middleware

- Entra directo a `http://localhost:3000/dashboard` sin sesion
- **Resultado esperado**: redireccion a `/login`

## Resolucion de Problemas

- **Error de DB**: confirma que `backend/docker-compose.yml` este corriendo y que la DB exponga `5433`.
- **Error de API**: confirma que `frontend/.env.local` tenga `NEXT_PUBLIC_API_URL=http://localhost:3001`.
- **Puerto ocupado**: libera `3000`, `3001` o `5433`.

## Nota Legacy

- No usar `docker-compose.yml` de la raiz para entorno local.
- Guias o scripts que usaban `3000` para backend, `3001` para frontend o `5432` para Postgres quedan obsoletos.
