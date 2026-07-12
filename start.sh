#!/bin/bash
set -e

clear

FORCE=false
if [ "$1" = "--full" ] || [ "$1" = "-f" ]; then
    FORCE=true
fi

CACHE_DIR=".dev-cache"
mkdir -p "$CACHE_DIR"

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
cd ..

# Instala dependencias solo si package-lock.json cambio (o no hay node_modules).
# Usa --full para forzar npm install / prisma migrate dev sin importar el hash.
install_if_needed() {
    local name="$1"
    local dir="$2"
    local lock="$dir/package-lock.json"
    local hash_file="$CACHE_DIR/${name}.install.hash"
    local current
    current=$(sha256sum "$lock" | awk '{print $1}')

    if [ "$FORCE" = true ] || [ ! -d "$dir/node_modules" ] || [ "$current" != "$(cat "$hash_file" 2>/dev/null)" ]; then
        echo "Instalando dependencias ($name)..."
        (cd "$dir" && npm install)
        echo "$current" > "$hash_file"
    else
        echo "Dependencias de $name sin cambios, se omite npm install."
    fi
}

echo ""
echo "[3/4] Preparando Backend..."
install_if_needed "backend" "backend"

SCHEMA_HASH_FILE="$CACHE_DIR/backend.schema.hash"
SCHEMA_HASH=$( { cat backend/prisma/schema.prisma; find backend/prisma/migrations -type f -name "*.sql" 2>/dev/null | sort | xargs cat 2>/dev/null; } | sha256sum | awk '{print $1}')

cd backend
if [ "$FORCE" = true ] || [ ! -d "node_modules/.prisma/client" ] || [ "$SCHEMA_HASH" != "$(cat "../$SCHEMA_HASH_FILE" 2>/dev/null)" ]; then
    npx prisma generate
    npx prisma migrate dev --name init_local --skip-generate
    echo "$SCHEMA_HASH" > "../$SCHEMA_HASH_FILE"
else
    echo "Schema/migraciones de Prisma sin cambios, se omite prisma generate/migrate dev."
fi
cd ..

echo ""
echo "[4/4] Preparando Frontend..."
install_if_needed "frontend" "frontend"

echo ""
echo "========================================================"
echo " SISTEMA LISTO. LEVANTANDO SERVIDORES..."
echo "========================================================"
echo "API Backend: http://localhost:3001"
echo "Frontend UI: http://localhost:3000"
echo "PostgreSQL: localhost:5433"
echo "Compose oficial DB: backend/docker-compose.yml"
echo "(tip: usa './start.sh --full' para forzar npm install y prisma migrate dev)"
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
