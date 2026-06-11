#!/bin/bash
set -e

clear

echo "========================================================"
echo "      INICIALIZANDO RECALL - ENTORNO LOCAL OFICIAL"
echo "========================================================"
echo ""

echo "[1/4] Iniciando Base de Datos local oficial..."
cd backend
docker-compose up -d
cd ..
sleep 3

echo ""
echo "[2/4] Verificando aislamiento de base de datos..."
cd backend
if ! npm run db:safe-check; then
    echo ""
    echo "ERROR DE SEGURIDAD detectado. Abortando..."
    exit 1
fi

echo ""
echo "[3/4] Preparando Backend..."
npm install
npx prisma generate
npx prisma migrate dev --name init_local --skip-generate
cd ..

echo ""
echo "[4/4] Preparando Frontend..."
cd frontend
npm install
cd ..

echo ""
echo "========================================================"
echo " SISTEMA LISTO. LEVANTANDO SERVIDORES..."
echo "========================================================"
echo "API Backend: http://localhost:3001"
echo "Frontend UI: http://localhost:3000"
echo "PostgreSQL: localhost:5433"
echo "Compose oficial DB: backend/docker-compose.yml"
echo "========================================================"
echo ""

(
    cd backend
    npm run start:dev
) &
BACKEND_PID=$!

(
    cd frontend
    npm run dev
) &
FRONTEND_PID=$!

cleanup() {
    trap - INT TERM EXIT
    echo ""
    echo "Deteniendo servidores..."
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}

trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM
trap cleanup EXIT

while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
    sleep 1
done

cleanup
wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
