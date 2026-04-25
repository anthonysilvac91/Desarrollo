# Recall Frontend (Next.js)

Interfaz de usuario para Recall, incluyendo dashboard web y experiencia movil operativa.

## Documentacion Principal

- [Arquitectura del Sistema](../ARCHITECTURE.md)
- [README Principal](../README.md)
- [Guia de Inicio](../START_GUIDE.md)

## Configuracion Local Oficial

- Frontend: `http://localhost:3000`
- API backend: `http://localhost:3001`
- Variable requerida: `NEXT_PUBLIC_API_URL=http://localhost:3001`

## Setup

1. `npm install`
2. Crear `.env.local` desde `.env.example`

## Ejecucion

- `npm run dev`: inicia el servidor en `http://localhost:3000`

## Estructura Clave

- `src/app/(main)`: dashboard principal
- `src/app/app`: experiencia mobile para workers
- `src/lib/AuthContext.tsx`: sesion, permisos y redirecciones
