# Restricciones para Manicuristas

## Objetivo
Las manicuristas solo pueden ver y gestionar información de sí mismas:
- Solo ver sus propias citas y disponibilidad
- Solo crear citas para sí mismas
- Solo ver estadísticas propias
- No pueden ver información de otras manicuristas

## Cambios Implementados

### 1. Citas (`/api/appointments`)

#### GET `/api/appointments`
- **Restricción**: Las manicuristas solo pueden ver sus propias citas
- **Implementación**: Fuerza `manicuristId` a `session.user.manicuristId`

#### GET `/api/appointments/:id`
- **Restricción**: Las manicuristas solo pueden ver detalles de sus propias citas
- **Implementación**: Verifica que `appointment.manicuristId === session.user.manicuristId`

#### POST `/api/appointments`
- **Restricción**: Las manicuristas solo pueden crear citas para sí mismas
- **Implementación**: Valida que `body.manicuristId === session.user.manicuristId`

#### PATCH `/api/appointments/:id`
- **Restricción**: Las manicuristas solo pueden modificar sus propias citas
- **Implementación**: 
  - Verifica que la cita pertenezca a la manicurista
  - No permite cambiar el `manicuristId`

#### DELETE `/api/appointments/:id`
- **Restricción**: Las manicuristas solo pueden cancelar sus propias citas
- **Implementación**: Verifica que la cita pertenezca a la manicurista

### 2. Disponibilidad

#### GET `/api/appointments/availability`
- **Restricción**: Las manicuristas solo pueden ver su propia disponibilidad
- **Implementación**: Fuerza `manicuristId` a `session.user.manicuristId`

#### GET `/api/appointments/availability/next`
- **Restricción**: Las manicuristas solo pueden ver su propia disponibilidad
- **Implementación**: Fuerza `manicuristId` a `session.user.manicuristId`

### 3. Manicuristas

#### GET `/api/manicurists`
- **Restricción**: Las manicuristas solo pueden verse a sí mismas
- **Implementación**: Filtra `where.id === session.user.manicuristId`

### 4. Dashboard

#### GET `/api/dashboard`
- **Restricción**: Las manicuristas solo ven sus propias estadísticas
- **Implementación**: 
  - Pasa `manicuristId` a `getDashboardStats`
  - Devuelve array vacío para `productivity` (no ven datos de otras manicuristas)

### 5. Clientes

#### GET `/clients`
- **Restricción**: Las manicuristas no pueden acceder a la página de clientes
- **Implementación**: Redirige a `/appointments` (ya existente en `src/app/(dashboard)/clients/page.tsx`)

## Validaciones Frontend

### Dashboard (`src/app/(dashboard)/dashboard/page.tsx`)
- Filtra citas por `manicuristId` cuando es manicurista
- Oculta ProductivityChart para manicuristas

### Citas (`src/app/(dashboard)/appointments/page.tsx`)
- Filtra citas por `manicuristId` cuando es manicurista
- Filtra manicuristas en calendario para mostrar solo la propia
- Pasa `lockedManicuristId` al componente

### Formulario de Cita (`src/components/appointments/NewAppointmentButton.tsx`)
- Usa `lockedManicuristId` para bloquear selector de manicurista
- Muestra manicurista como read-only cuando está bloqueado

## Mensajes de Error

Los mensajes de error para las manicuristas incluyen:

- `"No manicurist asociado"` - Cuando la manicurista no tiene `manicuristId`
- `"Las manicuristas solo pueden ver sus propias citas"` - Acceso a citas de otras
- `"Las manicuristas solo pueden crear citas para sí mismas"` - Crear cita para otra
- `"Solo puedes modificar tus propias citas"` - Editar cita de otra
- `"Solo puedes cancelar tus propias citas"` - Cancelar cita de otra
- `"No puedes cambiar la profesional de la cita"` - Intentar cambiar manicuristId
- `"Las manicuristas solo pueden ver su propia disponibilidad"` - Ver disponibilidad de otra

## Códigos de Estado

- `401 Unauthorized` - Sesión inválida
- `403 Forbidden` - No tienen permiso para realizar la acción (error de PERMISSION o AUTH)
- `404 Not Found` - Recurso no encontrado
- `422 Validation Error` - Datos inválidos en la solicitud

## Testing

Para probar las restricciones:

1. **Crear cuenta de manicurista**
2. **Iniciar sesión como manicurista**
3. **Intentar acceder a recursos de otras manicuristas**:
   - Intentar ver citas de otra manicurista (debería dar 403)
   - Intentar crear cita para otra manicurista (debería dar 403)
   - Intentar ver disponibilidad de otra manicurista (debería dar 403)
4. **Verificar que puedan usar su propio flujo**:
   - Ver sus propias citas
   - Crear citas para sí mismas
   - Ver su disponibilidad
