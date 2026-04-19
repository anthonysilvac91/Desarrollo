# Recall Backend (NestJS)

Esta es la API central del sistema Recall.

## 🔗 Documentación Principal
- [Arquitectura del Sistema](../ARCHITECTURE.md)
- [Contratos API](../API_CONTRACTS.md)
- [README Principal](../README.md)

## 🚀 Guía Local

### Setup
1. `npm install`
2. Configurar `.env` (basado en `.env.example`).
3. Port 5433 en la URL de Prisma si usas Docker local.

### Base de Datos
- `npx prisma db push`: Sincronizar esquema.
- `npx prisma db seed`: Cargar datos realistas para demos.
- `npx prisma studio`: Explorador visual de datos.

### Scripts
- `npm run start:dev`: Servidor en desarrollo con hot-reload.
- `npm run test:e2e`: Ejecutar suite de pruebas integrales.

---
Para más detalles técnicos, consulta el [README de la raíz](../README.md).
