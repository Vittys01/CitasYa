#!/usr/bin/env bash
# =============================================================================
# full-deploy.sh — Setup completo + deploy en un solo script
#
# Ejecutar como ROOT en un servidor Ubuntu fresco (DigitalOcean Droplet, etc.)
#
# Uso:
#   1. Conectate al servidor:  ssh root@<IP>
#   2. Cloná el repo:          git clone <REPO_URL> /opt/dates && cd /opt/dates
#   3. Ejecutá con variables:  REPO_URL=... APP_URL=... SSH_PUBKEY="..." bash scripts/full-deploy.sh
#
# Variables requeridas:
#   REPO_URL       URL del repositorio git (ej: https://github.com/user/dates.git)
#   APP_URL        URL pública (ej: https://tudominio.com)
#   SSH_PUBKEY     Tu clave SSH pública (para el usuario deploy)
#
# Variables opcionales:
#   NEW_USER       Usuario no-root (default: deploy)
#   AUTH_SECRET    Secret NextAuth (si no se pasa, se genera)
#   DOMAIN         Dominio para Nginx+SSL (ej: tudominio.com)
#   SSL_EMAIL      Email para Let's Encrypt (ej: admin@tudominio.com)
#   APPLY_SSH_HARDENING  1= aplicar hardening SSH (default), 0= saltar
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Verificar root ────────────────────────────────────────────────────────────
[[ $(id -u) -eq 0 ]] || error "Ejecutá este script como root: sudo bash scripts/full-deploy.sh"

# ── Variables requeridas ──────────────────────────────────────────────────────
if [[ -z "${REPO_URL:-}" ]]; then
  read -rp "  REPO_URL (git): " REPO_URL
fi
if [[ -z "${APP_URL:-}" ]]; then
  read -rp "  APP_URL (ej: https://tudominio.com): " APP_URL
fi
if [[ -z "${SSH_PUBKEY:-}" ]]; then
  read -rp "  SSH_PUBKEY (tu clave pública): " SSH_PUBKEY
fi

[[ -n "$REPO_URL" && -n "$APP_URL" && -n "$SSH_PUBKEY" ]] || error "Faltan REPO_URL, APP_URL o SSH_PUBKEY"

NEW_USER="${NEW_USER:-deploy}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Si hay DOMAIN pero no APP_URL con https, usamos https://DOMAIN
if [[ -n "${DOMAIN:-}" && "$APP_URL" == "http://"* ]]; then
  APP_URL="https://${DOMAIN}"
fi

echo ""
echo -e "${BOLD}================================================${NC}"
echo -e "${BOLD}   dates — Deploy completo (setup + app + nginx)${NC}"
echo -e "${BOLD}================================================${NC}"
echo ""
echo "  REPO_URL:  $REPO_URL"
echo "  APP_URL:   $APP_URL"
echo "  Usuario:   $NEW_USER"
echo ""

# ── 1. Setup servidor (hardening + Docker) ────────────────────────────────────
info "[1/3] Configurando servidor (hardening, UFW, Fail2ban, Docker)..."
export DEBIAN_FRONTEND=noninteractive
bash "$SCRIPT_DIR/setup-server.sh" "$NEW_USER" "$SSH_PUBKEY"
success "Servidor configurado"

# ── 2. Deploy app como usuario no-root ────────────────────────────────────────
info "[2/3] Desplegando aplicación..."
export REPO_URL APP_URL AUTH_SECRET APP_DIR="/home/$NEW_USER/app"

# Si el proyecto está en /root, deploy no puede leerlo. Copiamos deploy.sh a /tmp.
DEPLOY_SCRIPT="$PROJECT_ROOT/scripts/deploy.sh"
if [[ "$PROJECT_ROOT" == /root/* ]]; then
  mkdir -p /tmp/dates-scripts
  cp "$PROJECT_ROOT/scripts/deploy.sh" /tmp/dates-scripts/
  chmod 755 /tmp/dates-scripts/deploy.sh
  DEPLOY_SCRIPT="/tmp/dates-scripts/deploy.sh"
else
  chmod -R o+rX "$PROJECT_ROOT" 2>/dev/null || true
fi

su - "$NEW_USER" -c "REPO_URL='$REPO_URL' APP_URL='$APP_URL' AUTH_SECRET='${AUTH_SECRET:-}' APP_DIR=/home/$NEW_USER/app bash $DEPLOY_SCRIPT"
success "Aplicación desplegada"

# ── 3. Nginx + SSL (opcional) ─────────────────────────────────────────────────
if [[ -n "${DOMAIN:-}" && -n "${SSL_EMAIL:-}" ]]; then
  info "[3/3] Configurando Nginx + SSL para $DOMAIN..."
  bash "$SCRIPT_DIR/nginx-setup.sh" "$DOMAIN" "$SSL_EMAIL"
  success "Nginx + SSL listos"
else
  info "[3/3] Saltando Nginx (pasa DOMAIN y SSL_EMAIL para habilitar)"
fi

# ── 4. Verificar puertos expuestos ────────────────────────────────────────────
info "Verificando que Redis y Postgres NO estén expuestos..."
EXPOSED=$(ss -tlnp 2>/dev/null | grep -E ':(6379|5432)\s' || true)
if [[ -n "$EXPOSED" ]]; then
  warn "Redis o Postgres podrían estar expuestos. Revisá docker-compose."
else
  success "Redis y Postgres no expuestos (correcto)"
fi

# ── Resumen final ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}================================================${NC}"
success "Deploy completo finalizado"
echo -e "${BOLD}================================================${NC}"
echo ""
echo -e "  ${BOLD}App:${NC}         $APP_URL"
echo -e "  ${BOLD}Directorio:${NC}  /home/$NEW_USER/app"
echo ""
echo -e "${BOLD}Comandos útiles:${NC}"
echo "  ssh $NEW_USER@<IP>"
echo "  docker compose -f /home/$NEW_USER/app/docker-compose.yml logs -f app"
echo "  docker compose -f /home/$NEW_USER/app/docker-compose.yml ps"
echo ""
echo -e "${YELLOW}IMPORTANTE — Cloud Firewall (DigitalOcean):${NC}"
echo "  Creá un Firewall en Networking → Firewalls:"
echo "  - SSH (22): solo tu IP"
echo "  - HTTP (80), HTTPS (443): Any IPv4"
echo "  Así reducís ataques SSH y DDoS."
echo ""
