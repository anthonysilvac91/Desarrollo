#!/bin/bash
set -e

clear

echo "========================================================"
echo "      INICIALIZANDO RECALL - ENTORNO LOCAL SEGURO"
echo "========================================================"
echo ""

# 1. LEVANTAR DOCKER
echo "[1/4] Iniciando Base de Datos local (Docker)..."
if ! docker-compose up -d; then
    echo ""
    echo "❌ ERROR: Docker no esta iniciado o docker-compose no esta instalado."
    exit 1
fi
sleep 3

# 2. VALIDACION SEGURIDAD
echo ""
echo "[2/4] Verificando aislamiento de base de datos..."
cd backend
if ! npm run db:safe-check; then
    echo ""
    echo "❌ ERROR DE SEGURIDAD detectado. Abortando..."
    exit 1
fi

# 3. BACKEND
echo ""
echo "[3/4] Preparando Backend..."
npm install
echo "Generando Prisma Client..."
npx prisma generate
echo "Aplicando migraciones locales..."
npx prisma migrate dev --name init_local --skip-generate
cd ..

# 4. FRONTEND
echo ""
echo "[4/4] Preparando Frontend..."
cd frontend
npm install
cd ..

echo ""
echo "========================================================"
echo " SISTEMA LISTO. Levantando Servidores..."
echo "========================================================"
echo "API Backend: http://localhost:4000"
echo "Frontend UI: http://localhost:3000"
echo "========================================================"
echo ""

npx concurrently --kill-others --names "BACKEND,FRONTEND" --prefix-colors "magenta,cyan" "cd backend && npm run start:dev" "cd frontend && npm run dev"
