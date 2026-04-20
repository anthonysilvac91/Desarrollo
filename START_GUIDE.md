# Guía de Inicio: Validación de Funciones (Recall)

Esta guía detalla los pasos para levantar el entorno completo y validar los avances de la **Fase 1** (Login, Seguridad y Panel Maestro).

## 📋 Requisitos Previos
*   **Node.js**: 18.0 o superior.
*   **PostgreSQL**: Servicio activo en `localhost:5432` o Docker Desktop iniciado.
*   **Editor**: VS Code con soporte para TypeScript.

---

## 🛠️ Paso 1: Configuración de Base de Datos
1. Asegúrate de tener la DB corriendo.
2. Ve a la carpeta `backend/`.
3. Ejecuta los comandos de sincronización:
   ```bash
   npm install
   npx prisma generate
   npx prisma db seed
   ```
   > [!NOTE]
   > El comando `seed` es vital. Creará al usuario Maestro (`sys@recall.app`) y los datos de prueba.

---

## 🚀 Paso 2: Arranque de Servidores
Para validar el flujo completo, ambos servidores deben estar encendidos:

### Opción A: Script Automatizado (Recomendado)
Desde la raíz del proyecto, ejecuta el archivo `start.bat`. Este script instalará dependencias, preparará la DB y levantará ambos servidores en una sola ventana.

### Opción B: Arranque Manual
*   **Backend**: `cd backend && npm run start:dev` (Puerto 3000)
*   **Frontend**: `cd frontend && npm run dev` (Puerto 3001)

---

## 🔐 Paso 3: Validación del Flujo de Login (Fase 1)

Una vez los servidores estén arriba, abre `http://localhost:3001/login` y prueba los siguientes escenarios:

### 1. Acceso Maestro (SUPER_ADMIN)
*   **Usuario**: `sys@recall.app`
*   **Pass**: `password123`
*   **Resultado esperado**: Redirección automática a `/master`. Deberías ver la lista de organizaciones.

### 2. Acceso Administrador
*   **Usuario**: `admin@oceanic.app`
*   **Pass**: `password123`
*   **Resultado esperado**: Redirección a `/dashboard`.

### 3. Redirección Inteligente (Trabajador)
*   **Usuario**: `roberto@oceanic.app`
*   **Pass**: `password123`
*   **Validación PC**: Te llevará a `/assets` (Gestión de activos).
*   **Validación Móvil**: (Usa las herramientas de desarrollador F12 y activa modo móvil). Te llevará a `/app` (Nueva interfaz de campo).

### 4. Seguridad (Middleware)
*   Intenta entrar directamente a `http://localhost:3001/dashboard` sin sesión.
*   **Resultado esperado**: El sistema debe bloquear el acceso y devolverte a `/login`.

---

## 🛑 Resolución de Problemas
*   **Error "Can't reach database"**: Verifica que el servicio de Postgres esté iniciado.
*   **Error "Module not found"**: Corre `npm install` tanto en `frontend/` como en `backend/`.
*   **Puerto Ocupado**: Si el backend no inicia en el 3000, el frontend podría no conectar. Verifica que no haya otros procesos en el puerto 3000.
