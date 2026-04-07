@echo off
chcp 65001 >nul
echo.
echo ========================================================
echo       Inicializando Recall - Entorno Local
echo ========================================================
echo.

:: 1. BASE DE DATOS
echo [1/3] Iniciando la Base de Datos...
:: Si usas Docker para la DB en el backend, puedes descomentar la siguiente linea:
:: cd backend ^&^& docker-compose up -d ^&^& cd ..
:: timeout /t 3 >nul
echo (Nota: Asegúrese de tener el servicio de PostgreSQL activo en su maquina / Docker)

echo.
echo [2/3] Preparando Backend y Base de Datos...
cd backend
call npm install
echo - Generando Cliente de Prisma...
call npx prisma generate
echo - Sincronizando esquema de BD (Migrate)...
call npx prisma migrate deploy 2>NUL || echo (Aviso: No se aplicaron migraciones obligatorias)
echo - Ejecutando Seed para usuario administrador por defecto...
call npx prisma db seed
cd ..

echo.
echo [3/3] Preparando Frontend...
cd frontend
call npm install
cd ..

echo.
echo ========================================================
echo  Todo preparado. Levantando Servidores Simultaneamente...
echo ========================================================
echo El Backend estara en: http://localhost:3000
echo El Frontend estara en: http://localhost:3001 (o 3000 si esta libre)
echo.

:: Utilizamos concurrently via npx para correr ambos en una misma terminal
call npx concurrently --kill-others --names "BACKEND,FRONTEND" --prefix-colors "bgMagenta.bold,bgCyan.bold" "cd backend && npm run start:dev" "cd frontend && npm run dev"

pause
