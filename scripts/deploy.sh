#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Clonar y levantar dates-saas en producción
# Ejecutar como usuario no-root (ej: deploy): bash deploy.sh
#
# Variables de entorno opcionales para skip de prompts:
#   REPO_URL       URL del repositorio git
#   APP_DIR        Directorio donde clonar (default: ~/app)
#   APP_URL        URL pública de la app (ej: https://tudominio.com)
#   AUTH_SECRET    Secret de NextAuth (mínimo 32 chars)
#   EVOLUTION_KEY  API key de Evolution (WhatsApp)
# =============================================================================
set -euo pipefail

# ── Colores ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

echo ""
echo -e "${BOLD}================================================${NC}"
echo -e "${BOLD}   dates-saas — Deploy de Producción${NC}"
echo -e "${BOLD}================================================${NC}"
echo ""

# ── 1. Verificar dependencias ─────────────────────────────────────────────────
info "Verificando dependencias..."
command -v docker  &>/dev/null || error "Docker no está instalado. Corre setup-server.sh primero."
command -v git     &>/dev/null || error "Git no está instalado."
success "Docker y Git disponibles"

# ── 2. Configuración interactiva ──────────────────────────────────────────────
echo ""
echo -e "${BOLD}Configuración del proyecto${NC}"
echo "──────────────────────────────────────────────"

if [[ -z "${REPO_URL:-}" ]]; then
  read -rp "  URL del repositorio git: " REPO_URL
fi

APP_DIR="${APP_DIR:-$HOME/app}"
read -rp "  Directorio de instalación [$APP_DIR]: " INPUT_DIR
APP_DIR="${INPUT_DIR:-$APP_DIR}"

if [[ -z "${APP_URL:-}" ]]; then
  read -rp "  URL pública de la app (ej: https://tudominio.com): " APP_URL
fi
APP_URL="${APP_URL:-http://localhost:3000}"

if [[ -z "${AUTH_SECRET:-}" ]]; then
  # Generar secret automáticamente
  AUTH_SECRET=$(openssl rand -base64 48 | tr -d '\n')
  warn "AUTH_SECRET generado automáticamente (guárdalo si necesitas mantener sesiones):"
  echo "  $AUTH_SECRET"
fi

if [[ -z "${EVOLUTION_KEY:-}" ]]; then
  read -rp "  Evolution API key [evolution_secret]: " EVOLUTION_KEY
fi
EVOLUTION_KEY="${EVOLUTION_KEY:-evolution_secret}"

echo ""

# ── 3. Clonar o actualizar repositorio ────────────────────────────────────────
info "Clonando repositorio en $APP_DIR..."
if [[ -d "$APP_DIR/.git" ]]; then
  warn "Directorio ya existe. Haciendo pull..."
  git -C "$APP_DIR" pull origin main || git -C "$APP_DIR" pull origin master
else
  git clone "$REPO_URL" "$APP_DIR"
fi
success "Repositorio listo en $APP_DIR"

# ── 4. Crear archivo .env ─────────────────────────────────────────────────────
ENV_FILE="$APP_DIR/.env"

if [[ -f "$ENV_FILE" ]]; then
  warn ".env ya existe. Creando backup en .env.backup"
  cp "$ENV_FILE" "$ENV_FILE.backup"
fi

info "Generando .env..."
# Contraseñas de DB generadas aleatoriamente
DB_PASS=$(openssl rand -hex 16)
EVOLUTION_INSTANCE="dates-instance"

cat > "$ENV_FILE" <<EOF
# ── App ───────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL="${APP_URL}"
AUTH_URL="${APP_URL}"
NODE_ENV="production"

# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL="postgresql://dates_user:${DB_PASS}@postgres:5432/dates_db"

# ── Auth (NextAuth v5) ────────────────────────────────────────────────────────
AUTH_SECRET="${AUTH_SECRET}"

# ── Redis (BullMQ) ────────────────────────────────────────────────────────────
REDIS_URL="redis://redis:6379"

# ── WhatsApp (Evolution API) ──────────────────────────────────────────────────
WHATSAPP_PROVIDER="evolution"
EVOLUTION_API_URL="http://evolution:8080"
EVOLUTION_API_KEY="${EVOLUTION_KEY}"
EVOLUTION_INSTANCE="${EVOLUTION_INSTANCE}"

# ── Recordatorios ─────────────────────────────────────────────────────────────
REMINDER_HOURS_BEFORE="24"
EOF

# Actualizar las contraseñas de Postgres en docker-compose también via override
# (las credenciales del docker-compose deben coincidir con DATABASE_URL)
cat > "$APP_DIR/docker-compose.override.yml" <<EOF
services:
  postgres:
    environment:
      POSTGRES_USER:     dates_user
      POSTGRES_PASSWORD: "${DB_PASS}"
      POSTGRES_DB:       dates_db
  evolution:
    environment:
      DATABASE_CONNECTION_URI: "postgresql://dates_user:${DB_PASS}@postgres:5432/dates_db?schema=public"
      AUTHENTICATION_API_KEY:  "${EVOLUTION_KEY}"
EOF

success ".env generado"

# ── 5. Construir y levantar servicios ─────────────────────────────────────────
echo ""
info "Construyendo imágenes Docker (puede tardar varios minutos)..."
cd "$APP_DIR"

docker compose build --no-cache

info "Levantando servicios..."
docker compose up -d

# ── 6. Esperar que la app esté lista ─────────────────────────────────────────
echo ""
info "Esperando que la app responda..."
MAX_WAIT=120
ELAPSED=0
until curl -sf "http://localhost:3000/api/auth/session" &>/dev/null; do
  if [[ $ELAPSED -ge $MAX_WAIT ]]; then
    warn "La app tardó más de ${MAX_WAIT}s. Revisa logs: docker compose logs app"
    break
  fi
  sleep 5
  ELAPSED=$((ELAPSED + 5))
  echo -n "."
done
echo ""

# ── 7. Estado final ───────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}================================================${NC}"
success "Deploy completado!"
echo -e "${BOLD}================================================${NC}"
echo ""
echo -e "  ${BOLD}App URL:${NC}        $APP_URL"
echo -e "  ${BOLD}Puerto local:${NC}   http://localhost:3000"
echo -e "  ${BOLD}Directorio:${NC}     $APP_DIR"
echo ""
echo -e "${BOLD}Comandos útiles:${NC}"
echo "  Ver logs de la app:     docker compose -f $APP_DIR/docker-compose.yml logs -f app"
echo "  Ver todos los logs:     docker compose -f $APP_DIR/docker-compose.yml logs -f"
echo "  Reiniciar app:          docker compose -f $APP_DIR/docker-compose.yml restart app"
echo "  Estado servicios:       docker compose -f $APP_DIR/docker-compose.yml ps"
echo "  Parar todo:             docker compose -f $APP_DIR/docker-compose.yml down"
echo ""
echo -e "${YELLOW}Recuerda configurar Nginx + SSL con Certbot si usas dominio propio.${NC}"
echo -e "  bash nginx-setup.sh (ver scripts/nginx-setup.sh)"
echo ""
