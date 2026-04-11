# Bot de agendado por WhatsApp (Twilio)

El servidor expone **`POST /api/wet`**: Twilio envía aquí cada mensaje entrante; la app valida la firma, mantiene una sesión por número de teléfono y puede crear citas con la misma lógica que el panel.

## 1. Base de datos

Aplicá migraciones (incluye la tabla `WhatsAppBotSession`):

```bash
pnpm exec prisma migrate deploy
```

## 2. Variables de entorno

**Credenciales Twilio:**
- `TWILIO_ACCOUNT_SID`: Tu SID de cuenta de Twilio
- `TWILIO_AUTH_TOKEN`: Tu token de autenticación
- `TWILIO_WHATSAPP_NUMBER`: Tu número de WhatsApp (ej: `whatsapp:+14155238886`)

**Plantillas para notificaciones:**
- `TWILIO_CONTENT_SID_CONFIRMATION`: SID de plantilla para confirmaciones
- `TWILIO_CONTENT_SID_REMINDER`: SID de plantilla para recordatorios
- `TWILIO_CONTENT_SID_CANCELLATION`: SID de plantilla para cancelaciones

**Configuración del Bot:**
- `WHATSAPP_BOT_ENABLED`: `true` para activar, `false` para desactivar
- `WHATSAPP_BOT_BUSINESS_ID` (opcional): Forzar negocio específico
- `WHATSAPP_BOT_TIMEOUT_MINUTES`: Tiempo antes de expirar sesión (default: 30)
- `WHATSAPP_BOT_AUTO_WELCOME`: Enviar bienvenida al primer mensaje (default: true)
- `TWILIO_WEBHOOK_BASE_URL`: URL base pública (sin path) para validación de firma
- `TWILIO_SKIP_SIGNATURE_VALIDATION`: Solo desarrollo local (nunca en producción)

## 3. Twilio Console

1. **Messaging** → **Messaging Services** → tu servicio "Montecatini"
2. En **"Configure with"** → **"Webhook"**
3. En **"A message comes in"**, configura:
   - **URL**: `https://TU_DOMINIO/api/wet`
   - **Method**: `HTTP POST`
4. Guardá. El número debe ser el mismo que `TWILIO_WHATSAPP_NUMBER`.

## 4. Desarrollo local

Twilio no puede llegar a `localhost`. Usá un túnel (ngrok, Cloudflare Tunnel, etc.) y:

- Apuntá el webhook a `https://TU_TUNEL/api/wet`
- Definí `TWILIO_WEBHOOK_BASE_URL=https://TU_TUNEL`
- Podés poner `TWILIO_SKIP_SIGNATURE_VALIDATION=true` mientras probás

## 5. Flujo del usuario

1. Escribe cualquier mensaje o **MENU** / **HOLA** → lista de opciones (agendar, consultar, cancelar)
2. Elige **AGENDAR** → lista de manicuristas
3. Elige manicurista (1, 2, … o nombre) → lista de servicios
4. Elige servicio → pide fecha (HOY, MAÑANA, próximos 7 días, o fecha específica)
5. Elige horario de la lista → se crea la cita y se envía confirmación por WhatsApp

Comandos especiales:
- **MENU**: Vuelve al menú principal
- **AGENDAR**: Inicia flujo de agendado
- **CITAS**: Muestra tus citas activas
- **CANCELAR [número]**: Cancela cita específica
- **AYUDA**: Muestra comandos disponibles
- **DISPONIBILIDAD**: Muestra horarios disponibles

## 6. Clientes nuevos

Si el número no existe, se crea un cliente con nombre `Cliente XXXX` (últimos 4 dígitos). Podés editarlo después desde el panel.

## 7. Configuración de Webhook Twilio

La URL del webhook que debes configurar en Twilio es:

```
https://TU_DOMINIO/api/wet
```

Esta endpoint:
- Valida la firma `X-Twilio-Signature` usando `TWILIO_AUTH_TOKEN`
- Identifica el negocio por `TWILIO_WHATSAPP_NUMBER`
- Guarda mensajes en la base de datos
- Procesa el mensaje con el bot de agendado
- Responde automáticamente al cliente

## 8. Plantillas de Twilio Content

Para que funcionen las notificaciones de WhatsApp, necesitas tener plantillas aprobadas en Twilio Content API con las siguientes variables:

- `{{1}}`: Nombre del cliente
- `{{2}}`: Fecha/hora/servicio de la cita
- `{{3}}`: Profesional o "—" en caso de cancelación

Ejemplo de plantilla de confirmación:
```
Hola {{1}}, confirmamos tu cita para el {{2}}.
Profesional: {{3}}.
Te esperamos!
```

## 9. Depuración y Monitoreo

El bot registra toda la actividad en la consola:

```
[Twilio Webhook] Incoming request: ...
[Twilio Webhook] Message from +54911... to whatsapp:+16812812834: "hola"
[WhatsApp Bot - Twilio] Processing message from +54911... for business ...
[WhatsApp Bot - Twilio] Response sent to +54911... Next step: idle
```

Revisa los logs para identificar problemas o verificar el funcionamiento del bot.

## 10. Errores Comunes

**Firma inválida:**
- Error: `[Twilio Webhook] Invalid signature received`
- Solución: Verificar que `TWILIO_WEBHOOK_BASE_URL` sea correcta o activar `TWILIO_SKIP_SIGNATURE_VALIDATION` en desarrollo

**Negocio no encontrado:**
- Error: `[Twilio Webhook] Business not found for number ...`
- Solución: Verificar que `TWILIO_WHATSAPP_NUMBER` coincida con el número configurado en la tabla `Business`

**Bot no responde:**
- Verificar que `WHATSAPP_BOT_ENABLED=true`
- Revisar logs del servidor
- Verificar que el endpoint `/api/wet` sea accesible externamente
- Validar que el número de WhatsApp esté activo en Twilio

## 11. Estructura de Sesión del Bot

El bot mantiene el estado de cada conversación en la tabla `WhatsAppBotSession`:

- `step`: Estado actual del flujo (idle, manicurist, service, date, slot, etc.)
- `data`: JSON con selecciones temporales (manicuristId, serviceId, selectedDate, etc.)
- `updatedAt`: Última actividad de la sesión
- `phoneE164`: Número de teléfono del cliente (formato E.164)

Las sesiones expiran automáticamente después de `WHATSAPP_BOT_TIMEOUT_MINUTES` (default: 30 minutos).

## 12. Personalización de Mensajes

Los mensajes del bot se pueden personalizar editando las plantillas en `/src/lib/bot-messages.ts`:

- `buildMenuMessage()`: Menú principal
- `buildBookingIntro()`: Introducción al flujo de agendado
- `buildConfirmationMessage()`: Confirmación de cita
- `buildAppointmentListMessage()`: Lista de citas del cliente
- `buildCancellationSuccessMessage()`: Mensaje de cancelación exitosa

También puedes modificar el texto de ayuda en `buildHelpMessage()`.
