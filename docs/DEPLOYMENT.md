# Despliegue económico — Dates

La app necesita **3 componentes** principales (+ worker opcional recomendado):

| Componente      | Uso |
|-----------------|-----|
| Next.js         | App web (dashboard, API); envía confirmaciones WhatsApp al crear turnos (en el mismo proceso) |
| PostgreSQL      | Base de datos (Prisma) |
| Worker          | Auto-completar citas pasadas y reconciliar recordatorios tras reinicios (sin Redis) |

WhatsApp soporta **Meta Cloud API** o **Twilio**. Configurá las credenciales por negocio en el panel Owner, o usá variables en `.env` como fallback: `META_WHATSAPP_TOKEN`/`META_PHONE_NUMBER_ID` (Meta) o `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_WHATSAPP_NUMBER` (Twilio).

---

## Opción más económica: **un VPS con Docker**

Un solo servidor donde corre todo con `docker-compose`. Coste típico **~5–7 USD/mes**.

### Por qué es la más barata

- Un único pago mensual (no pagas por servicio separado de DB, etc.).
- Tu `docker-compose.yml` define app, worker y Postgres (sin Redis).
- Control total: mismo stack que en local, solo que en un VPS.

### Proveedores recomendados (ordenados por precio)

| Proveedor     | Plan mínimo      | Precio aprox. | Notas                    |
|---------------|-------------------|---------------|---------------------------|
| **Hetzner**   | CX22 (2 GB RAM)   | ~4–5 €/mes    | Muy buena relación precio/rendimiento |
| **Contabo**   | VPS S             | ~5 €/mes      | Bastante RAM por precio   |
| **DigitalOcean** | Basic Droplet 1 GB | 6 USD/mes  | Fácil de usar, buena doc  |
| **Vultr**     | Cloud Compute    | ~6 USD/mes    | Varias regiones           |

Para esta app (Next.js + Postgres + worker), un VPS de **2 GB RAM** suele ir bien; 1 GB puede quedarse justo.

### Pasos en el VPS

#### Opción A: Deploy completo (recomendado)

Un solo script que hace todo: hardening, Docker, deploy y opcionalmente Nginx+SSL.

```bash
# 1. Crear el servidor (Ubuntu 22.04 o 24.04) y conectarte como root
ssh root@<IP>

# 2. Clonar repo y ejecutar full-deploy
git clone <tu-repo> /opt/dates && cd /opt/dates

REPO_URL="https://github.com/tu-usuario/dates.git" \
APP_URL="https://tudominio.com" \
SSH_PUBKEY="$(cat ~/.ssh/id_ed25519.pub)" \
DOMAIN="tudominio.com" \
SSL_EMAIL="admin@tudominio.com" \
bash scripts/full-deploy.sh
```

**Seguridad** (incluida): UFW, Fail2ban (ban 24h), SSH sin root/contraseña, Postgres no expuesto al exterior.

**Después del deploy:** Crear un Cloud Firewall en DigitalOcean (Networking → Firewalls) con SSH solo a tu IP.

#### Opción B: Pasos manuales

1. **Crear el servidor** (Ubuntu 22.04 o 24.04).

2. **Setup inicial** (como root): `bash scripts/setup-server.sh deploy "ssh-ed25519 AAAA... tu@mac"`

3. **Deploy** (como deploy): `REPO_URL=... APP_URL=... bash scripts/deploy.sh`

4. **HTTPS** (opcional): `sudo bash scripts/nginx-setup.sh tudominio.com admin@tudominio.com`

**Alternativa manual** (sin scripts): instalar Docker, clonar repo, configurar `.env` con las variables de abajo y ejecutar `docker compose up -d`.



### Variables en producción (resumen)

En el VPS, en el mismo `.env` que usa `docker compose`:

- `DATABASE_URL=postgresql://dates_user:dates_pass@postgres:5432/dates_db`
- `AUTH_SECRET=<generado con openssl rand -base64 32>`
- `NEXT_PUBLIC_APP_URL=https://tudominio.com`
- `META_WHATSAPP_TOKEN` y `META_PHONE_NUMBER_ID` (Meta) o `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` (Twilio) — opcional si configurás por negocio en el panel Owner

No hace falta cambiar el resto del `docker-compose` si ya usas estas variables en `x-app-env`.

---

## Otras opciones (menos económicas pero más “managed”)

- **Railway / Render**: Podés desplegar app + worker + Postgres; ya no hace falta Redis en el stack.
- **Vercel + VPS**: El worker de fondo conviene en un proceso de larga duración (p. ej. mismo VPS con Docker que Postgres).

---

## Resumen

- **Más económico y suficiente para que la app funcione:** **1 VPS (2 GB RAM) + Docker Compose** (~5–7 USD/mes).
- Configurar **HTTPS con Caddy** (Let’s Encrypt) y usar el mismo `docker-compose` que ya tienes, ajustando solo el `.env` como arriba.
