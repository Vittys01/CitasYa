import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const business = await prisma.business.findFirst({ where: { slug: "default" } });
  if (!business) {
    throw new Error("No default business found. Run migrations first.");
  }
  const businessId = business.id;

  const adminPassword = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@dates.app" },
    update: { password: adminPassword },
    create: {
      email: "admin@dates.app",
      password: adminPassword,
      name: "Admin",
      role: Role.OWNER,
    },
  });

  const maniPass = await bcrypt.hash("mani123", 12);

  await prisma.user.upsert({
    where: { email: "sofia@dates.app" },
    update: {},
    create: {
      email: "sofia@dates.app",
      password: maniPass,
      name: "Sofía Romero",
      role: Role.MANICURIST,
      manicurist: {
        create: {
          businessId,
          color: "#ec4899",
          schedules: {
            createMany: {
              data: [1, 2, 3, 4, 5].map((day) => ({
                dayOfWeek: day,
                startTime: "09:00",
                endTime: "18:00",
              })),
            },
          },
        },
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "valentina@dates.app" },
    update: {},
    create: {
      email: "valentina@dates.app",
      password: maniPass,
      name: "Valentina López",
      role: Role.MANICURIST,
      manicurist: {
        create: {
          businessId,
          color: "#8b5cf6",
          schedules: {
            createMany: {
              data: [1, 2, 3, 4, 5].map((day) => ({
                dayOfWeek: day,
                startTime: "10:00",
                endTime: "19:00",
              })),
            },
          },
        },
      },
    },
  });

  await prisma.service.createMany({
    skipDuplicates: true,
    data: [
      { businessId, name: "Manicura clásica",        duration: 45,  price: 3500,  color: "#f472b6" },
      { businessId, name: "Manicura semipermanente",  duration: 60,  price: 5500,  color: "#c084fc" },
      { businessId, name: "Pedicura clásica",         duration: 60,  price: 4000,  color: "#60a5fa" },
      { businessId, name: "Pedicura semipermanente",  duration: 75,  price: 6000,  color: "#34d399" },
      { businessId, name: "Uñas acrílicas",           duration: 120, price: 9500,  color: "#fb923c" },
      { businessId, name: "Nail art (diseño simple)", duration: 30,  price: 1500,  color: "#fbbf24" },
    ],
  });

  await prisma.client.upsert({
    where: { businessId_phone: { businessId, phone: "+5491112345678" } },
    update: {},
    create: {
      businessId,
      name: "María García",
      phone: "+5491112345678",
      email: "maria@example.com",
      notes: "Alergia a acrílico marca X",
    },
  });

  // ── App settings (ALL labels/copy – editable from Prisma Studio or a settings UI) ──
  const defaultSettings: Array<{ key: string; value: string }> = [
    // App
    { key: "app.name",    value: "Dates" },
    { key: "app.tagline", value: "Gestión de turnos" },
    { key: "app.version", value: "v1.0" },
    // Navigation
    { key: "nav.dashboard",    value: "Dashboard" },
    { key: "nav.appointments", value: "Agenda" },
    { key: "nav.clients",      value: "Clientes" },
    { key: "nav.settings",     value: "Configuración" },
    // Roles
    { key: "role.OWNER",        value: "Dueño" },
    { key: "role.ADMIN",        value: "Administradora" },
    { key: "role.MANICURIST",   value: "Manicurista" },
    { key: "role.RECEPTIONIST", value: "Recepcionista" },
    // Sections
    { key: "section.services",    value: "Catálogo de servicios" },
    { key: "section.servicesSub", value: "servicios registrados" },
    { key: "section.addService",  value: "Agregar servicio" },
    { key: "section.team",        value: "Equipo" },
    { key: "section.usersSub",    value: "usuarios registrados" },
    { key: "section.schedule",    value: "Horario" },
    { key: "action.editSchedule", value: "Editar horario" },
    { key: "schedule.empty",      value: "Sin horario cargado" },
    { key: "schedule.editSub",    value: "Las citas se ofrecen según este horario" },
    { key: "schedule.from",       value: "Desde" },
    { key: "schedule.to",         value: "Hasta" },
    { key: "calendar.dayLabel",   value: "Día" },
    { key: "confirm.cancelAppointment", value: "¿Cancelar este turno?" },
    { key: "common.cancelling",   value: "Cancelando..." },
    { key: "action.cancelAppointment",  value: "Cancelar turno" },
    // Statuses
    { key: "status.PENDING",   value: "Pendiente" },
    { key: "status.CONFIRMED", value: "Confirmado" },
    { key: "status.CANCELLED", value: "Cancelado" },
    { key: "status.COMPLETED", value: "Completado" },
    // Common
    { key: "common.active",   value: "Activo" },
    { key: "common.archived", value: "Archivado" },
    { key: "common.minutes",  value: "min" },
    { key: "common.saving",   value: "Guardando..." },
    { key: "common.saved",    value: "Guardado" },
    { key: "common.cancel",   value: "Cancelar" },
    { key: "common.save",     value: "Guardar" },
    // Actions
    { key: "action.newAppointment",   value: "Nuevo turno" },
    { key: "action.saveAppointment",  value: "Guardar turno" },
    { key: "action.newClient",        value: "Nuevo cliente" },
    { key: "action.createClient",     value: "Crear cliente" },
    { key: "action.addManicurist",    value: "Agregar manicurista" },
    { key: "action.createManicurist", value: "Crear manicurista" },
    { key: "action.archive",          value: "Archivar" },
    { key: "action.activate",         value: "Activar" },
    { key: "action.delete",           value: "Eliminar" },
    { key: "common.deleting",         value: "Eliminando..." },
    { key: "confirm.deleteService.title", value: "¿Eliminar servicio?" },
    { key: "confirm.deleteService.body",  value: "Vas a eliminar permanentemente" },
    { key: "confirm.deleteService.warn",  value: "Esta acción no se puede deshacer." },
    { key: "action.signOut",          value: "Cerrar sesión" },
    // Dashboard
    { key: "dashboard.welcome",    value: "Bienvenida" },
    { key: "dashboard.todayTitle", value: "Turnos de hoy" },
    { key: "dashboard.todaySub",   value: "activos" },
    { key: "dashboard.noAppts",    value: "Sin turnos para hoy" },
    // Stats cards
    { key: "stats.todayLabel",           value: "Turnos hoy" },
    { key: "stats.completedLabel",       value: "Completados hoy" },
    { key: "stats.revenueDayLabel",      value: "Ingresos del día" },
    { key: "stats.revenueMonthLabel",    value: "Ingresos del mes" },
    { key: "stats.confirmedSub",         value: "confirmados" },
    { key: "stats.pendingSub",           value: "pendientes" },
    { key: "stats.finishedSub",          value: "servicios finalizados" },
    { key: "stats.fromCompletedSub",     value: "de turnos completados" },
    { key: "stats.appointmentsInPeriod", value: "turnos en el período" },
    // Productivity chart
    { key: "chart.productivity.title",    value: "Productividad" },
    { key: "chart.productivity.subtitle", value: "Ingresos por profesional (mes actual)" },
    { key: "chart.tooltip.revenue",       value: "Ingresos" },
    { key: "chart.legend.appointments",   value: "turnos" },
    { key: "chart.empty",                 value: "Sin datos en el período" },
    // Pages
    { key: "page.appointmentsTitle", value: "Agenda" },
    { key: "page.appointmentsSub",   value: "Vista semanal de todos los turnos" },
    { key: "page.clientsTitle",      value: "Clientes" },
    { key: "page.clientsSub",        value: "clientes registrados" },
    { key: "page.settingsTitle",     value: "Configuración" },
    { key: "page.settingsSub",       value: "Gestión de servicios y usuarios del sistema" },
    // Calendar
    { key: "calendar.view.week",  value: "Semana" },
    { key: "calendar.view.day",   value: "Día" },
    { key: "calendar.filter.all", value: "Todas" },
    { key: "calendar.detailTitle", value: "Detalle del turno" },
    { key: "calendar.day.0",      value: "Dom" },
    { key: "calendar.day.1",      value: "Lun" },
    { key: "calendar.day.2",      value: "Mar" },
    { key: "calendar.day.3",      value: "Mié" },
    { key: "calendar.day.4",      value: "Jue" },
    { key: "calendar.day.5",      value: "Vie" },
    { key: "calendar.day.6",      value: "Sáb" },
    // Table columns
    { key: "table.clientColumn", value: "Cliente" },
    { key: "table.phone",        value: "Teléfono" },
    { key: "table.email",        value: "Email" },
    { key: "table.appointments", value: "Turnos" },
    { key: "table.notes",        value: "Notas" },
    { key: "table.service",      value: "Servicio" },
    { key: "table.duration",     value: "Duración" },
    { key: "table.price",        value: "Precio" },
    { key: "table.status",       value: "Estado" },
    // Pagination
    { key: "pagination.previous", value: "Anterior" },
    { key: "pagination.next",     value: "Siguiente" },
    { key: "pagination.page",     value: "página" },
    // Search
    { key: "search.clients", value: "Buscar por nombre, teléfono o email..." },
    // Empty states
    { key: "empty.clients", value: "No se encontraron clientes" },
    // Form: New appointment
    { key: "form.title.newAppointment",      value: "Nuevo turno" },
    { key: "form.subtitle.newAppointment",   value: "Completá los datos del turno" },
    { key: "form.section.clientData",        value: "Datos del cliente" },
    { key: "form.section.service",           value: "Servicio" },
    { key: "form.section.schedule",          value: "Horario" },
    { key: "form.clientLabel",               value: "Cliente" },
    { key: "form.selectClient",              value: "Seleccionar cliente..." },
    { key: "form.serviceLabel",              value: "Servicio" },
    { key: "form.serviceType",               value: "Tipo de servicio" },
    { key: "form.selectService",             value: "Seleccionar servicio..." },
    { key: "form.field.manicurist",          value: "Profesional" },
    { key: "form.select.anyManicurist",      value: "Cualquiera (próximos disponibles)" },
    { key: "form.field.nextSlots",           value: "Próximos turnos (3 opciones)" },
    { key: "form.field.duration",            value: "Duración" },
    { key: "form.field.total",               value: "Total" },
    { key: "form.field.internalNotes",       value: "Notas internas" },
    { key: "form.placeholder.internalNotes", value: "Ej: cliente prefiere sesión en silencio" },
    { key: "form.whatsapp.label",            value: "Enviar confirmación por WhatsApp" },
    { key: "form.whatsapp.sub",              value: "Mensaje automático con fecha y hora" },
    // Form: New client
    { key: "form.title.newClient",         value: "Nuevo cliente" },
    { key: "form.subtitle.newClient",      value: "Registrá un nuevo cliente" },
    { key: "form.field.fullName",          value: "Nombre completo" },
    { key: "form.placeholder.name",        value: "María García" },
    { key: "form.field.phone",             value: "WhatsApp / Teléfono" },
    { key: "form.placeholder.phone",       value: "+54 9 11 1234-5678, +57 300 1234567, +34 612 345 678" },
    { key: "validation.phoneRequired",     value: "Ingresá el teléfono" },
    { key: "form.field.emailOptional",     value: "Email (opcional)" },
    { key: "form.placeholder.email",       value: "cliente@email.com" },
    { key: "form.placeholder.clientNotes", value: "Alergias, preferencias..." },
    // Form: Services settings
    { key: "form.field.name",          value: "Nombre" },
    { key: "form.placeholder.service", value: "Manicura clásica" },
    { key: "form.field.durationMin",   value: "Duración (min)" },
    { key: "form.field.priceArs",      value: "Precio ($)" },
    // Form: Users settings
    { key: "form.field.calendarColor",   value: "Color en calendario" },
    { key: "form.placeholder.nameMani",  value: "Sofía Romero" },
    { key: "form.placeholder.emailMani", value: "sofia@dates.app" },
    { key: "form.field.password",        value: "Contraseña" },
    { key: "form.placeholder.password",  value: "Mínimo 8 caracteres" },
    // Messages
    { key: "message.selectServiceFirst", value: "Elegí un servicio primero" },
    { key: "message.searchingSlots",     value: "Buscando turnos..." },
    { key: "message.noAvailability",     value: "Sin disponibilidad" },
    // Currency
    { key: "app.currency",       value: "ARS" },
    { key: "app.currencyLocale", value: "es-AR" },
    // Form: extra
    { key: "form.field.color",        value: "Color" },
    { key: "action.editService",      value: "Editar" },
    { key: "section.currency",        value: "Moneda" },
    { key: "section.currencySub",     value: "Moneda usada para mostrar precios en toda la app" },
    { key: "currency.label.ARS",      value: "Peso argentino" },
    { key: "currency.label.USD",      value: "Dólar estadounidense" },
    { key: "currency.label.COP",      value: "Peso colombiano" },
    { key: "currency.label.EUR",      value: "Euro" },
    // Errors
    { key: "error.createAppointment", value: "Error al crear el turno" },
    { key: "error.createClient",      value: "Error al crear el cliente" },
    // Validation
    { key: "validation.selectClient",     value: "Seleccioná un cliente" },
    { key: "validation.selectManicurist", value: "Seleccioná una profesional" },
    { key: "validation.selectService",    value: "Seleccioná un servicio" },
    { key: "validation.selectDateTime",   value: "Seleccioná fecha y hora" },
    { key: "validation.minLength",        value: "Mínimo 2 caracteres" },
    { key: "validation.invalidPhone",     value: "Teléfono inválido" },
    { key: "validation.invalidEmail",     value: "Email inválido" },
  ];

  for (const { key, value } of defaultSettings) {
    await prisma.appSetting.upsert({
      where:  { businessId_key: { businessId, key } },
      update: { value },
      create: { businessId, key, value },
    });
  }

  console.log(`✅ Seed complete – ${defaultSettings.length} settings upserted`);
  console.log(`   Admin: admin@dates.app / admin123`);
  console.log(`   Manicurist: sofia@dates.app / mani123`);
  console.log(`   Manicurist: valentina@dates.app / mani123`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
