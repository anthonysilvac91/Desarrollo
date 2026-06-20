@echo off
SETLOCAL EnableDelayedExpansion

cls

echo ========================================================
echo       INICIALIZANDO RECALL - ENTORNO LOCAL OFICIAL
echo ========================================================
echo.

echo [1/4] Iniciando Base de Datos local oficial...
pushd backend
call docker-compose up -d
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Docker o docker-compose no disponible.
    popd
    pause
    exit /b 1
)
popd
timeout /t 3 >nul

echo.
echo [2/4] Verificando aislamiento de base de datos...
cd backend
call npm run db:safe-check
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR DE SEGURIDAD detectado. Abortando...
    cd ..
    pause
    exit /b 1
)

echo.
echo [3/4] Preparando Backend...
echo Cerrando backend local previo si esta usando el puerto 3001...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3001 .*LISTENING"') do (
    taskkill /PID %%P /F >nul 2>&1
)
timeout /t 1 >nul

call npm install --ignore-scripts
call npx prisma generate
call npx prisma migrate dev --name init_local --skip-generate
cd ..

echo.
echo [4/4] Preparando Frontend...
cd frontend
call npm install
cd ..

echo.
echo ========================================================
echo  SISTEMA LISTO. LEVANTANDO SERVIDORES...
echo ========================================================
echo API Backend: http://localhost:3001
echo Frontend UI: http://localhost:3000
echo PostgreSQL: localhost:5433
echo Compose oficial DB: backend/docker-compose.yml
echo ========================================================
echo.

call npx concurrently --kill-others --names "BACKEND,FRONTEND" --prefix-colors "magenta,cyan" "cd backend && npm run start:dev" "cd frontend && npm run dev"

pause
