#!/usr/bin/env bash
# =============================================================================
# setup-server.sh — Hardening + Docker en Ubuntu fresco
# Ejecutar como root: bash setup-server.sh <tu-usuario> <tu-ssh-pubkey>
#
# Ejemplo:
#   bash setup-server.sh deploy "ssh-ed25519 AAAA... user@mac"
# =============================================================================
set -euo pipefail

# ── Argumentos ────────────────────────────────────────────────────────────────
NEW_USER="${1:-deploy}"
SSH_PUBKEY="${2:-}"

if [[ -z "$SSH_PUBKEY" ]]; then
  echo "ERROR: Debes pasar tu SSH public key como segundo argumento."
  echo "  bash setup-server.sh deploy \"ssh-ed25519 AAAA...\""
  exit 1
fi

echo ""
echo "============================================="
echo "  Configurando servidor para usuario: $NEW_USER"
echo "============================================="
echo ""

# ── 1. Actualizar sistema ──────────────────────────────────────────────────────
echo "[1/8] Actualizando paquetes..."
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq \
  curl wget git ufw fail2ban unattended-upgrades \
  ca-certificates gnupg lsb-release

# ── 2. Crear usuario no-root ───────────────────────────────────────────────────
echo "[2/8] Creando usuario '$NEW_USER'..."
if ! id "$NEW_USER" &>/dev/null; then
  useradd -m -s /bin/bash -G sudo "$NEW_USER"
  echo "$NEW_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/$NEW_USER"
  chmod 440 "/etc/sudoers.d/$NEW_USER"
fi

# Agregar SSH key al nuevo usuario
mkdir -p "/home/$NEW_USER/.ssh"
echo "$SSH_PUBKEY" > "/home/$NEW_USER/.ssh/authorized_keys"
chmod 700 "/home/$NEW_USER/.ssh"
chmod 600 "/home/$NEW_USER/.ssh/authorized_keys"
chown -R "$NEW_USER:$NEW_USER" "/home/$NEW_USER/.ssh"
echo "   SSH key agregada para $NEW_USER"

# ── 3. Hardening SSH ──────────────────────────────────────────────────────────
echo "[3/8] Configurando SSH seguro..."
SSH_CONFIG="/etc/ssh/sshd_config"
cp "$SSH_CONFIG" "${SSH_CONFIG}.bak"

sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' "$SSH_CONFIG"
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' "$SSH_CONFIG"
sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' "$SSH_CONFIG"
sed -i 's/^#\?X11Forwarding.*/X11Forwarding no/' "$SSH_CONFIG"

# Agregar si no existen
grep -q "^PermitRootLogin" "$SSH_CONFIG"         || echo "PermitRootLogin no"         >> "$SSH_CONFIG"
grep -q "^PasswordAuthentication" "$SSH_CONFIG"  || echo "PasswordAuthentication no"  >> "$SSH_CONFIG"
grep -q "^PubkeyAuthentication" "$SSH_CONFIG"    || echo "PubkeyAuthentication yes"   >> "$SSH_CONFIG"

systemctl restart ssh

# ── 4. Firewall UFW ───────────────────────────────────────────────────────────
echo "[4/8] Configurando firewall UFW..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment "SSH"
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"
ufw --force enable
echo "   UFW habilitado. Puertos abiertos: 22, 80, 443"

# ── 5. Fail2ban ───────────────────────────────────────────────────────────────
echo "[5/8] Configurando Fail2ban..."
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 3
ignoreip = 127.0.0.1/8

[sshd]
enabled  = true
port     = ssh
EOF
systemctl enable fail2ban
systemctl restart fail2ban

# ── 6. Actualizaciones automáticas de seguridad ───────────────────────────────
echo "[6/8] Habilitando actualizaciones automáticas de seguridad..."
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

# ── 7. Instalar Docker ────────────────────────────────────────────────────────
echo "[7/8] Instalando Docker..."
if ! command -v docker &>/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
else
  echo "   Docker ya está instalado."
fi

# Agregar usuario al grupo docker
usermod -aG docker "$NEW_USER"
systemctl enable docker

# ── 8. Resumen ────────────────────────────────────────────────────────────────
echo ""
echo "============================================="
echo "  Servidor listo!"
echo "============================================="
echo ""
echo "  Usuario:        $NEW_USER"
echo "  SSH key:        configurada"
echo "  Root login:     DESHABILITADO"
echo "  Contraseña SSH: DESHABILITADA"
echo "  UFW:            activo (22, 80, 443)"
echo "  Fail2ban:       activo"
echo "  Docker:         instalado"
echo ""
echo "  Próximo paso — conectate como $NEW_USER y corre deploy.sh:"
echo "    ssh $NEW_USER@<IP>"
echo "    bash deploy.sh"
echo ""
echo "  IMPORTANTE: Verifica que puedes conectarte con SSH key"
echo "  ANTES de cerrar esta sesión root."
echo ""
