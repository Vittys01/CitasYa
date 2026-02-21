# Despliegue económico — Dates

La app necesita **5 componentes** para funcionar:

| Componente      | Uso                          |
|-----------------|------------------------------|
| Next.js         | App web (dashboard, API)     |
| PostgreSQL      | Base de datos (Prisma)       |
| Redis           | Colas BullMQ (mensajes WA)   |
| Worker (BullMQ) | Envío de WhatsApp + auto-completar citas |
| Evolution API   | Conexión WhatsApp            |

---

## Opción más económica: **un VPS con Docker**

Un solo servidor donde corre todo con `docker-compose`. Coste típico **~5–7 USD/mes**.

### Por qué es la más barata

- Un único pago mensual (no pagas por servicio separado de DB, Redis, etc.).
- Tu `docker-compose.yml` ya define app, worker, Evolution, Postgres y Redis.
- Control total: mismo stack que en local, solo que en un VPS.

### Proveedores recomendados (ordenados por precio)

| Proveedor     | Plan mínimo      | Precio aprox. | Notas                    |
|---------------|-------------------|---------------|---------------------------|
| **Hetzner**   | CX22 (2 GB RAM)   | ~4–5 €/mes    | Muy buena relación precio/rendimiento |
| **Contabo**   | VPS S             | ~5 €/mes      | Bastante RAM por precio   |
| **DigitalOcean** | Basic Droplet 1 GB | 6 USD/mes  | Fácil de usar, buena doc  |
| **Vultr**     | Cloud Compute    | ~6 USD/mes    | Varias regiones           |

Para esta app (Next.js + Postgres + Redis + worker + Evolution), un VPS de **2 GB RAM** suele ir bien; 1 GB puede quedarse justo.

### Pasos en el VPS

1. **Crear el servidor** (Ubuntu 22.04 o 24.04).

2. **Instalar Docker y Docker Compose**:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   # Cerrar sesión y volver a entrar
   ```

3. **Clonar el repo y configurar entorno**:
   ```bash
   git clone <tu-repo> dates && cd dates
   cp .env.example .env
   # Editar .env con:
   # - DATABASE_URL (usar postgres:5432 si todo va en Docker)
   # - REDIS_URL (redis://redis:6379)
   # - AUTH_SECRET (generar uno fuerte: openssl rand -base64 32)
   # - NEXT_PUBLIC_APP_URL=https://tudominio.com
   # - EVOLUTION_API_URL=http://evolution:8080 (mismo que en docker-compose)
   ```

4. **Levantar todo**:
   ```bash
   docker compose up -d
   ```

5. **HTTPS con Caddy** (opcional pero recomendado, gratis con Let’s Encrypt):
   ```bash
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt update && sudo apt install caddy
   sudo systemctl enable --now caddy
   ```
   Configurar Caddy como proxy inverso a `http://localhost:3000` para tu dominio (o usar la Caddyfile que prefieras).

### Variables en producción (resumen)

En el VPS, en el mismo `.env` que usa `docker compose`:

- `DATABASE_URL=postgresql://dates_user:dates_pass@postgres:5432/dates_db`
- `REDIS_URL=redis://redis:6379`
- `AUTH_SECRET=<generado con openssl rand -base64 32>`
- `NEXT_PUBLIC_APP_URL=https://tudominio.com`
- `EVOLUTION_API_URL=http://evolution:8080`
- `EVOLUTION_API_KEY=evolution_secret` (mismo que en el servicio Evolution en docker-compose)
- `EVOLUTION_INSTANCE=dates-instance`

No hace falta cambiar el resto del `docker-compose` si ya usas estas variables en `x-app-env`.

---

## Otras opciones (menos económicas pero más “managed”)

- **Railway**: App + Worker + Postgres + Redis en un proyecto. Pago por uso; suele estar en el rango 10–25 USD/mes con todo incluido. No tienes que administrar el OS.
- **Render**: Web + Worker + Postgres + Redis. Plan gratuito limita y tiene cold starts; para producción estable suele ser ~15–20 USD/mes.
- **Vercel + VPS**: Vercel solo para el front/API no cubre Worker ni Evolution; seguirías necesitando un VPS (o similar) para worker + Evolution + Redis, así que el coste total no suele ser menor que “todo en un VPS”.

---

## Resumen

- **Más económico y suficiente para que la app funcione:** **1 VPS (2 GB RAM) + Docker Compose** (~5–7 USD/mes).
- Configurar **HTTPS con Caddy** (Let’s Encrypt) y usar el mismo `docker-compose` que ya tienes, ajustando solo el `.env` como arriba.
