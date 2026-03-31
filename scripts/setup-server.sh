#!/usr/bin/env bash
# =============================================================================
# setup-server.sh — Hardening + Docker en Ubuntu fresco
# Ejecutar como root: bash setup-server.sh <tu-usuario> <tu-ssh-pubkey>
#
# Ejemplo:
#   bash setup-server.sh deploy "ssh-ed25519 AAAA... user@mac"
# =============================================================================
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

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
echo "[1/9] Actualizando paquetes..."
apt-get update -qq
apt-get upgrade -y -o Dpkg::Options::="--force-confold" -qq
apt-get install -y -qq \
  curl wget git ufw fail2ban unattended-upgrades \
  ca-certificates gnupg lsb-release

# ── 2. Crear usuario no-root ───────────────────────────────────────────────────
echo "[2/9] Creando usuario '$NEW_USER'..."
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
# Aplicamos hardening: solo claves SSH, sin root login.
# IMPORTANTE: Verificá que podés conectar como $NEW_USER antes de ejecutar esto.
# Si pasás APPLY_SSH_HARDENING=0, se salta este paso.
echo "[3/9] Hardening SSH..."
if [[ "${APPLY_SSH_HARDENING:-1}" == "1" ]]; then
  sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
  sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
  systemctl restart ssh
  echo "   Root login y contraseñas deshabilitados. Solo SSH por clave."
else
  echo "   Saltado (APPLY_SSH_HARDENING=0). Ejecutá manualmente después de verificar acceso."
fi

# ── 4. Firewall UFW ───────────────────────────────────────────────────────────
echo "[4/9] Configurando firewall UFW..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment "SSH"
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"
ufw --force enable
echo "   UFW habilitado. Puertos abiertos: 22, 80, 443"

# ── 5. Fail2ban (estricto: 24h ban, 3 intentos) ───────────────────────────────
echo "[5/9] Configurando Fail2ban (bantime 24h)..."
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime  = 86400
findtime = 300
maxretry = 3
ignoreip = 127.0.0.1/8

[sshd]
enabled  = true
port     = ssh
EOF
systemctl enable fail2ban
systemctl restart fail2ban

# ── 6. Actualizaciones automáticas de seguridad ───────────────────────────────
echo "[6/9] Habilitando actualizaciones automáticas de seguridad..."
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

# ── 7. Instalar Docker ────────────────────────────────────────────────────────
echo "[7/9] Instalando Docker..."
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

# ── 8. Verificar que Postgres no esté expuesto ────────────────────────────────
echo "[8/8] Verificando puertos expuestos..."
EXPOSED=$(ss -tlnp 2>/dev/null | grep -E ':5432\s' || true)
if [[ -n "$EXPOSED" ]]; then
  echo "   ADVERTENCIA: Postgres (5432) podría estar expuesto."
  echo "   Asegurate de que docker-compose NO mapee ese puerto al host."
else
  echo "   OK: Postgres no expuesto en el host."
fi

# ── 9. Resumen ────────────────────────────────────────────────────────────────
echo ""
echo "============================================="
echo "  Servidor listo!"
echo "============================================="
echo ""
echo "  Usuario:        $NEW_USER"
echo "  SSH key:        configurada"
echo "  Root login:     deshabilitado"
echo "  Contraseña SSH: deshabilitada"
echo "  UFW:            activo (22, 80, 443)"
echo "  Fail2ban:       activo (ban 24h, 3 intentos)"
echo "  Docker:         instalado"
echo ""
echo "  Próximo paso — conectate como $NEW_USER y corre deploy:"
echo "    ssh $NEW_USER@<IP>"
echo "    bash scripts/deploy.sh"
echo ""
echo "  O usa full-deploy.sh para todo en un solo paso."
echo ""
