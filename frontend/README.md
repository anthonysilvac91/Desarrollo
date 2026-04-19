# Recall Frontend (Next.js)

Interfaz de usuario para Recall, incluyendo el Dashboard de escritorio y la App móvil operativa.

## 🔗 Documentación Principal
- [Arquitectura del Sistema](../ARCHITECTURE.md)
- [README Principal](../README.md)

## 🚀 Guía Local

### Setup
1. `npm install`
2. Configurar `.env.local` (apuntando a `NEXT_PUBLIC_API_URL=http://localhost:3001`).

### Ejecución
- `npm run dev`: Inicia el servidor de desarrollo en `http://localhost:3000`.

### Estructura Clave
- `src/app/(main)`: Dashboard principal (Admin/Worker/Client).
- `src/app/app`: Experiencia mobile optimizada para Workers.
- `src/lib/AuthContext.tsx`: Guardián de sesión y permisos.

---
Para más detalles técnicos, consulta el [README de la raíz](../README.md).
