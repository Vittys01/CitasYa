#!/usr/bin/env bash
# =============================================================================
# nginx-setup.sh — Instalar Nginx como reverse proxy + SSL con Certbot
# Ejecutar como root o con sudo: sudo bash nginx-setup.sh tudominio.com email@tudominio.com
#
# Requisitos:
#   - La app ya debe estar corriendo en localhost:3000
#   - El dominio debe apuntar a la IP del servidor (DNS configurado)
# =============================================================================
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Uso: sudo bash nginx-setup.sh tudominio.com admin@tudominio.com"
  exit 1
fi

echo ""
echo "============================================="
echo "  Nginx + SSL para: $DOMAIN"
echo "============================================="
echo ""

# ── 1. Instalar Nginx y Certbot ────────────────────────────────────────────────
echo "[1/4] Instalando Nginx y Certbot..."
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx

# Abrir puerto 443 en UFW
ufw allow 443/tcp comment "HTTPS" 2>/dev/null || true

# ── 2. Crear config Nginx ──────────────────────────────────────────────────────
echo "[2/4] Configurando Nginx para $DOMAIN..."
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"

cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Seguridad básica
    add_header X-Frame-Options "SAMEORIGIN"         always;
    add_header X-Content-Type-Options "nosniff"     always;
    add_header X-XSS-Protection "1; mode=block"     always;
    add_header Referrer-Policy "strict-origin"       always;

    # Limitar tamaño de uploads
    client_max_body_size 10M;

    # Proxy a la app Next.js
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Upgrade           \$http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }
}
EOF

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
echo "   Nginx configurado OK"

# ── 3. SSL con Certbot ────────────────────────────────────────────────────────
echo "[3/4] Obteniendo certificado SSL..."
certbot --nginx \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive \
  --redirect

# ── 4. Renovación automática ──────────────────────────────────────────────────
echo "[4/4] Configurando renovación automática de SSL..."
# Certbot ya instala un timer, solo verificamos
systemctl enable certbot.timer 2>/dev/null || true
# Cron de respaldo
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet") | sort -u | crontab -

echo ""
echo "============================================="
echo "  Nginx + SSL listos!"
echo "============================================="
echo ""
echo "  App disponible en: https://$DOMAIN"
echo "  Certificado SSL:   Let's Encrypt (auto-renovable)"
echo ""
