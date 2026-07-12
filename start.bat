@echo off
SETLOCAL EnableDelayedExpansion

cls

set "FORCE=false"
if /I "%~1"=="--full" set "FORCE=true"
if /I "%~1"=="-f" set "FORCE=true"

set "CACHE_DIR=.dev-cache"
if not exist "%CACHE_DIR%" mkdir "%CACHE_DIR%"

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
cd ..

echo.
echo [3/4] Preparando Backend...
call :installIfNeeded backend backend

set "SCHEMA_HASH_FILE=%CACHE_DIR%\backend.schema.hash"
set "SCHEMA_TMP=%CACHE_DIR%\backend.schema.tmp"
type backend\prisma\schema.prisma > "%SCHEMA_TMP%"
for /f "delims=" %%F in ('dir /b /s /o:n backend\prisma\migrations\*.sql 2^>nul') do type "%%F" >> "%SCHEMA_TMP%"
call :hashFile "%SCHEMA_TMP%" SCHEMA_HASH
del "%SCHEMA_TMP%" >nul 2>&1

set "SCHEMA_HASH_PREV="
if exist "%SCHEMA_HASH_FILE%" set /p SCHEMA_HASH_PREV=<"%SCHEMA_HASH_FILE%"

if "%FORCE%"=="true" set "SCHEMA_CHANGED=1"
if not exist "backend\node_modules\.prisma\client" set "SCHEMA_CHANGED=1"
if not "%SCHEMA_HASH%"=="%SCHEMA_HASH_PREV%" set "SCHEMA_CHANGED=1"

if defined SCHEMA_CHANGED (
    cd backend
    call npx prisma generate
    call npx prisma migrate dev --name init_local --skip-generate
    cd ..
    >"%SCHEMA_HASH_FILE%" echo %SCHEMA_HASH%
) else (
    echo Schema/migraciones de Prisma sin cambios, se omite prisma generate/migrate dev.
)

echo.
echo [4/4] Preparando Frontend...
call :installIfNeeded frontend frontend

echo.
echo ========================================================
echo  SISTEMA LISTO. LEVANTANDO SERVIDORES...
echo ========================================================
echo API Backend: http://localhost:3001
echo Frontend UI: http://localhost:3000
echo PostgreSQL: localhost:5433
echo Compose oficial DB: backend/docker-compose.yml
echo (tip: usa "start.bat --full" para forzar npm install y prisma migrate dev)
echo ========================================================
echo.

call npx concurrently --kill-others --names "BACKEND,FRONTEND" --prefix-colors "magenta,cyan" "cd backend && npm run start:dev" "cd frontend && npm run dev"

pause
exit /b 0

:installIfNeeded
setlocal
set "NAME=%~1"
set "DIR=%~2"
set "HASH_FILE=%CACHE_DIR%\%NAME%.install.hash"
call :hashFile "%DIR%\package-lock.json" CUR_HASH
set "PREV_HASH="
if exist "%HASH_FILE%" set /p PREV_HASH=<"%HASH_FILE%"

set "NEEDS_INSTALL="
if "%FORCE%"=="true" set "NEEDS_INSTALL=1"
if not exist "%DIR%\node_modules" set "NEEDS_INSTALL=1"
if not "%CUR_HASH%"=="%PREV_HASH%" set "NEEDS_INSTALL=1"

if defined NEEDS_INSTALL (
    echo Instalando dependencias ^(%NAME%^)...
    pushd "%DIR%"
    call npm install
    popd
    >"%HASH_FILE%" echo %CUR_HASH%
) else (
    echo Dependencias de %NAME% sin cambios, se omite npm install.
)
endlocal
exit /b 0

:hashFile
setlocal
set "_HF_FILE=%~1"
set "_HF_RESULT="
for /f "skip=1 tokens=* delims=" %%H in ('certutil -hashfile "%_HF_FILE%" SHA256 ^2^>nul') do (
    if not defined _HF_RESULT set "_HF_RESULT=%%H"
)
set "_HF_RESULT=%_HF_RESULT: =%"
endlocal & set "%~2=%_HF_RESULT%"
exit /b 0
