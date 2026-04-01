# Bot de agendado por WhatsApp (Twilio)

El servidor expone **`POST /api/webhooks/twilio/whatsapp`**: Twilio envía aquí cada mensaje entrante; la app valida la firma, mantiene una sesión por número de teléfono y puede crear citas con la misma lógica que el panel.

## 1. Base de datos

Aplicá migraciones (incluye la tabla `WhatsAppBotSession`):

```bash
pnpm exec prisma migrate deploy
```

## 2. Variables de entorno

- Credenciales Twilio habituales: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` (formato `whatsapp:+…`).
- **`TWILIO_WEBHOOK_BASE_URL`**: origen público **sin path** (ej. `https://app.tudominio.com`). Debe coincidir con la URL que Twilio usa al firmar; si el proxy añade o quita `www`, la firma fallará.
- **`WHATSAPP_BOT_BUSINESS_ID`** (opcional): si el número “From” de Twilio solo está en `.env` y no en ningún `Business.twilioWhatsAppNumber`, se usa el primer negocio activo o el ID que indiques aquí.
- **`WHATSAPP_BOT_ENABLED`**: `false` para apagar el bot sin quitar el webhook.
- **`TWILIO_SKIP_SIGNATURE_VALIDATION=true`**: solo en desarrollo con túnel; **no** en producción.

El token para validar la firma es `Business.twilioAuthToken` si existe; si no, `TWILIO_AUTH_TOKEN`.

## 3. Twilio Console

1. **Messaging** → tu **WhatsApp sender** (o **Sandbox** para pruebas).
2. En **“When a message comes in”**, método **POST** y URL:

   `https://TU_DOMINIO/api/webhooks/twilio/whatsapp`

3. Guardá. El número debe ser el mismo que `TWILIO_WHATSAPP_NUMBER` (o el configurado en el negocio en el panel Owner).

## 4. Desarrollo local

Twilio no puede llegar a `localhost`. Usá un túnel (ngrok, Cloudflare Tunnel, etc.) y:

- Apuntá el webhook a `https://TU_TUNEL/api/webhooks/twilio/whatsapp`.
- Definí `TWILIO_WEBHOOK_BASE_URL=https://TU_TUNEL` (mismo host que ve Twilio).
- Podés poner `TWILIO_SKIP_SIGNATURE_VALIDATION=true` mientras probás.

## 5. Flujo del usuario

1. Escribe cualquier mensaje o **MENU** / **HOLA** → lista de manicuristas (números).
2. Elige manicurista (1, 2, …) → lista de servicios.
3. Elige servicio → pide fecha (HOY, MAÑANA, `AAAA-MM-DD` o `día/mes`).
4. Elige horario de la lista → se crea la cita y se envía confirmación por WhatsApp (si el envío global está configurado).

Comandos: **MENU** reinicia el listado de manicuristas; **CANCELAR** borra el flujo.

## 6. Clientes nuevos

Si el número no existe, se crea un cliente con nombre `Cliente XXXX` (últimos 4 dígitos). Podés editarlo después desde el panel.
