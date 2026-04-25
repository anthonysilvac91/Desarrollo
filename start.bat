@echo off
SETLOCAL EnableDelayedExpansion

:: Limpiar pantalla
cls

echo ========================================================
echo       INICIALIZANDO RECALL - ENTORNO LOCAL SEGURO
echo ========================================================
echo.

:: 1. LEVANTAR DOCKER
echo [1/4] Iniciando Base de Datos local (Docker)...
:: Usamos call para asegurar que el control regrese al script
call docker-compose up -d
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ ERROR: Docker Desktop no esta iniciado o docker-compose no esta instalado.
    pause
    exit /b 1
)
:: Esperar a que Postgres este listo
timeout /t 3 >nul

:: 2. VALIDACION SEGURIDAD
echo.
echo [2/4] Verificando aislamiento de base de datos...
cd backend
:: El safe-check que creamos antes
call npm run db:safe-check
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ ERROR DE SEGURIDAD detectado. Abortando...
    cd ..
    pause
    exit /b 1
)

:: 3. BACKEND
echo.
echo [3/4] Preparando Backend...
call npm install
echo Generando Prisma Client...
call npx prisma generate
echo Aplicando migraciones locales...
:: --skip-generate evita redundancia, --skip-seed lo manejaremos aparte si es necesario
call npx prisma migrate dev --name init_local --skip-generate
cd ..

:: 4. FRONTEND
echo.
echo [4/4] Preparando Frontend...
cd frontend
call npm install
cd ..

echo.
echo ========================================================
echo  SISTEMA LISTO. Levantando Servidores...
echo ========================================================
echo API Backend: http://localhost:4000
echo Frontend UI: http://localhost:3000
echo ========================================================
echo.

:: Lanzar ambos en una misma terminal usando concurrently
call npx concurrently --kill-others --names "BACKEND,FRONTEND" --prefix-colors "magenta,cyan" "cd backend && npm run start:dev" "cd frontend && npm run dev"

pause
