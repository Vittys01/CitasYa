# Despliegue económico — Dates

La app necesita **4 componentes** para funcionar:

| Componente      | Uso                          |
|-----------------|------------------------------|
| Next.js         | App web (dashboard, API)     |
| PostgreSQL      | Base de datos (Prisma)       |
| Redis           | Colas BullMQ (mensajes WA)   |
| Worker (BullMQ) | Envío de WhatsApp + auto-completar citas |

WhatsApp usa **Meta Cloud API**. Configurá las credenciales por negocio en el panel Owner, o usá `META_WHATSAPP_TOKEN` y `META_PHONE_NUMBER_ID` en el `.env` como fallback.

---

## Opción más económica: **un VPS con Docker**

Un solo servidor donde corre todo con `docker-compose`. Coste típico **~5–7 USD/mes**.

### Por qué es la más barata

- Un único pago mensual (no pagas por servicio separado de DB, Redis, etc.).
- Tu `docker-compose.yml` ya define app, worker, Postgres y Redis.
- Control total: mismo stack que en local, solo que en un VPS.

### Proveedores recomendados (ordenados por precio)

| Proveedor     | Plan mínimo      | Precio aprox. | Notas                    |
|---------------|-------------------|---------------|---------------------------|
| **Hetzner**   | CX22 (2 GB RAM)   | ~4–5 €/mes    | Muy buena relación precio/rendimiento |
| **Contabo**   | VPS S             | ~5 €/mes      | Bastante RAM por precio   |
| **DigitalOcean** | Basic Droplet 1 GB | 6 USD/mes  | Fácil de usar, buena doc  |
| **Vultr**     | Cloud Compute    | ~6 USD/mes    | Varias regiones           |

Para esta app (Next.js + Postgres + Redis + worker), un VPS de **2 GB RAM** suele ir bien; 1 GB puede quedarse justo.

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

**Seguridad** (incluida): UFW, Fail2ban (ban 24h), SSH sin root/contraseña, Redis/Postgres no expuestos.

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
- `REDIS_URL=redis://redis:6379`
- `AUTH_SECRET=<generado con openssl rand -base64 32>`
- `NEXT_PUBLIC_APP_URL=https://tudominio.com`
- `META_WHATSAPP_TOKEN` y `META_PHONE_NUMBER_ID` (opcional si configurás por negocio en el panel Owner)

No hace falta cambiar el resto del `docker-compose` si ya usas estas variables en `x-app-env`.

---

## Otras opciones (menos económicas pero más “managed”)

- **Railway**: App + Worker + Postgres + Redis en un proyecto. Pago por uso; suele estar en el rango 10–25 USD/mes con todo incluido. No tienes que administrar el OS.
- **Render**: Web + Worker + Postgres + Redis. Plan gratuito limita y tiene cold starts; para producción estable suele ser ~15–20 USD/mes.
- **Vercel + VPS**: Vercel solo para el front/API no cubre Worker; seguirías necesitando un VPS (o similar) para worker + Redis, así que el coste total no suele ser menor que “todo en un VPS”.

---

## Resumen

- **Más económico y suficiente para que la app funcione:** **1 VPS (2 GB RAM) + Docker Compose** (~5–7 USD/mes).
- Configurar **HTTPS con Caddy** (Let’s Encrypt) y usar el mismo `docker-compose` que ya tienes, ajustando solo el `.env` como arriba.
