# Sistema de Auto-Completado de Citas

## Funcionalidad

El sistema automáticamente marca como **COMPLETED** todas las citas que ya pasaron su fecha/hora y que no fueron canceladas.

## Cómo Funciona

### 1. Worker Automático (Heroku)

- **Ubicación**: `src/jobs/worker.ts`
- **Frecuencia**: Cada 60 segundos
- **Función**: `autoCompleteExpiredAppointments()` en `src/services/appointment.service.ts`

El worker busca todas las citas con:
- Estado: `PENDING` o `CONFIRMED`
- Fecha de fin: `endAt` en el pasado (menor a `now()`)

Y las actualiza a estado `COMPLETED`.

### 2. Configuración en Heroku

El archivo `app.json` configura automáticamente el worker para que se ejecute:
```json
{
  "formation": {
    "web": { "quantity": 1, "size": "basic" },
    "worker": { "quantity": 1, "size": "basic" }
  }
}
```

### 3. Endpoint de Respaldo (Manual)

Para casos donde el worker no esté disponible, existe un endpoint API:

**POST** `/api/admin/auto-complete-expired`

- Requiere autenticación y rol `OWNER` o `ADMIN`
- Completa inmediatamente todas las citas expiradas
- Retorna la cantidad de citas completadas

## Verificar Estado del Worker

### Usar el script automatizado:
```bash
./scripts/ensure-worker.sh
```

### Verificar manualmente:
```bash
# Ver estado de todos los procesos
heroku ps --app dates-saas

# Escalar el worker si no está corriendo
heroku ps:scale worker=1 --app dates-saas
```

## Dashboard

Las citas completadas se muestran en el dashboard con:
- **Etiqueta**: "COMPLETED" (o etiqueta personalizada en settings)
- **Estilo**: Fondo café claro con icono `task_alt`
- **Componente**: `TodayAppointments` muestra citas activas (incluye COMPLETED)
- **Estadísticas**: Se cuentan en `completedToday` y revenue

## Estados de Cita

- `PENDING`: Turno pendiente de confirmación
- `CONFIRMED`: Turno confirmado
- `COMPLETED`: Turno completado (automático cuando pasa la fecha)
- `CANCELLED`: Turno cancelado

## Troubleshooting

### Las citas no se completan automáticamente

1. **Verificar que el worker esté corriendo**:
   ```bash
   heroku ps --app dates-saas
   ```

2. **Ejecutar el endpoint manualmente**:
   ```bash
   curl -X POST https://dates-saas.herokuapp.com/api/admin/auto-complete-expired \
     -H "Content-Type: application/json"
   ```

3. **Revisar logs del worker**:
   ```bash
   heroku logs --tail --app dates-saas --dyno worker
   ```

### Worker consume muchos recursos

Si el worker consume demasiados recursos, puedes:
- Reducir la frecuencia en `src/jobs/worker.ts` (línea 36)
- Cambiar el size en `app.json` de `basic` a `eco`

## Notas Técnicas

- La lógica de auto-completado es idempotente (se puede ejecutar múltiples veces sin problemas)
- Las citas canceladas nunca se completan automáticamente
- Se usa `endAt` para determinar si una cita expiró, no `startAt`
