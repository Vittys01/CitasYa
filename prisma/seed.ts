import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Limpiando base de datos...");

  // Delete in dependency order
  await prisma.notification.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.client.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.manicurist.deleteMany();
  await prisma.service.deleteMany();
  await prisma.appSetting.deleteMany();
  await prisma.user.deleteMany();
  await prisma.business.deleteMany();

  console.log("✅ Base de datos limpia");
  console.log("🌱 Sembrando datos...");

  // ── OWNER ──────────────────────────────────────────────────────────────────
  const ownerPassword = await bcrypt.hash("123vittyS", 12);
  const owner = await prisma.user.create({
    data: {
      email: "bvittys@gmail.com",
      password: ownerPassword,
      name: "Vittys",
      role: Role.OWNER,
      isActive: true,
    },
  });

  // ── BUSINESS: Montecatini ──────────────────────────────────────────────────
  const business = await prisma.business.create({
    data: {
      name: "Montecatini",
      slug: "montecatini",
      ownerId: owner.id,
      isActive: true,
    },
  });
  const businessId = business.id;

  // Link owner to business
  await prisma.user.update({
    where: { id: owner.id },
    data: { businessId },
  });

  // ── ADMIN: Paola López ─────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash("Montecatini123", 12);
  await prisma.user.create({
    data: {
      email: "paolalopez@gmail.com",
      password: adminPassword,
      name: "Paola López",
      role: Role.ADMIN,
      businessId,
      isActive: true,
    },
  });

  // ── MANICURISTS ────────────────────────────────────────────────────────────
  const maniPassword = await bcrypt.hash("123mani", 12);

  await prisma.user.create({
    data: {
      email: "mafe@gmail.com",
      password: maniPassword,
      name: "Mafe",
      role: Role.MANICURIST,
      businessId,
      isActive: true,
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

  await prisma.user.create({
    data: {
      email: "paola@gmail.com",
      password: maniPassword,
      name: "Paola",
      role: Role.MANICURIST,
      businessId,
      isActive: true,
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

  // ── SERVICES ───────────────────────────────────────────────────────────────
  await prisma.service.createMany({
    data: [
      { businessId, name: "Manicura clásica",         duration: 45,  price: 3500,  color: "#f472b6" },
      { businessId, name: "Manicura semipermanente",   duration: 60,  price: 5500,  color: "#c084fc" },
      { businessId, name: "Pedicura clásica",          duration: 60,  price: 4000,  color: "#60a5fa" },
      { businessId, name: "Pedicura semipermanente",   duration: 75,  price: 6000,  color: "#34d399" },
      { businessId, name: "Uñas acrílicas",            duration: 120, price: 9500,  color: "#fb923c" },
      { businessId, name: "Nail art (diseño simple)",  duration: 30,  price: 1500,  color: "#fbbf24" },
    ],
  });

  // ── APP SETTINGS ───────────────────────────────────────────────────────────
  const defaultSettings: Array<{ key: string; value: string }> = [
    { key: "app.name",    value: "Montecatini" },
    { key: "app.tagline", value: "Gestión de turnos" },
    { key: "app.version", value: "v1.0" },
    { key: "nav.dashboard",    value: "Dashboard" },
    { key: "nav.appointments", value: "Agenda" },
    { key: "nav.clients",      value: "Clientes" },
    { key: "nav.settings",     value: "Configuración" },
    { key: "role.OWNER",        value: "Dueño" },
    { key: "role.ADMIN",        value: "Administradora" },
    { key: "role.MANICURIST",   value: "Manicurista" },
    { key: "role.RECEPTIONIST", value: "Recepcionista" },
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
    { key: "status.PENDING",   value: "Pendiente" },
    { key: "status.CONFIRMED", value: "Confirmado" },
    { key: "status.CANCELLED", value: "Cancelado" },
    { key: "status.COMPLETED", value: "Completado" },
    { key: "common.active",   value: "Activo" },
    { key: "common.archived", value: "Archivado" },
    { key: "common.minutes",  value: "min" },
    { key: "common.saving",   value: "Guardando..." },
    { key: "common.saved",    value: "Guardado" },
    { key: "common.cancel",   value: "Cancelar" },
    { key: "common.save",     value: "Guardar" },
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
    { key: "dashboard.welcome",    value: "Bienvenida" },
    { key: "dashboard.todayTitle", value: "Turnos de hoy" },
    { key: "dashboard.todaySub",   value: "activos" },
    { key: "dashboard.noAppts",    value: "Sin turnos para hoy" },
    { key: "stats.todayLabel",           value: "Turnos hoy" },
    { key: "stats.completedLabel",       value: "Completados hoy" },
    { key: "stats.revenueDayLabel",      value: "Ingresos del día" },
    { key: "stats.revenueMonthLabel",    value: "Ingresos del mes" },
    { key: "stats.confirmedSub",         value: "confirmados" },
    { key: "stats.pendingSub",           value: "pendientes" },
    { key: "stats.finishedSub",          value: "servicios finalizados" },
    { key: "stats.fromCompletedSub",     value: "de turnos completados" },
    { key: "stats.appointmentsInPeriod", value: "turnos en el período" },
    { key: "chart.productivity.title",    value: "Productividad" },
    { key: "chart.productivity.subtitle", value: "Ingresos por profesional (mes actual)" },
    { key: "chart.tooltip.revenue",       value: "Ingresos" },
    { key: "chart.legend.appointments",   value: "turnos" },
    { key: "chart.empty",                 value: "Sin datos en el período" },
    { key: "page.appointmentsTitle", value: "Agenda" },
    { key: "page.appointmentsSub",   value: "Vista semanal de todos los turnos" },
    { key: "page.clientsTitle",      value: "Clientes" },
    { key: "page.clientsSub",        value: "clientes registrados" },
    { key: "page.settingsTitle",     value: "Configuración" },
    { key: "page.settingsSub",       value: "Gestión de servicios y usuarios del sistema" },
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
    { key: "table.clientColumn", value: "Cliente" },
    { key: "table.phone",        value: "Teléfono" },
    { key: "table.email",        value: "Email" },
    { key: "table.appointments", value: "Turnos" },
    { key: "table.notes",        value: "Notas" },
    { key: "table.service",      value: "Servicio" },
    { key: "table.duration",     value: "Duración" },
    { key: "table.price",        value: "Precio" },
    { key: "table.status",       value: "Estado" },
    { key: "pagination.previous", value: "Anterior" },
    { key: "pagination.next",     value: "Siguiente" },
    { key: "pagination.page",     value: "página" },
    { key: "search.clients", value: "Buscar por nombre, teléfono o email..." },
    { key: "empty.clients", value: "No se encontraron clientes" },
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
    { key: "form.field.name",          value: "Nombre" },
    { key: "form.placeholder.service", value: "Manicura clásica" },
    { key: "form.field.durationMin",   value: "Duración (min)" },
    { key: "form.field.priceArs",      value: "Precio (€)" },
    { key: "form.field.calendarColor",   value: "Color en calendario" },
    { key: "form.placeholder.nameMani",  value: "Sofía Romero" },
    { key: "form.placeholder.emailMani", value: "sofia@dates.app" },
    { key: "form.field.password",        value: "Contraseña" },
    { key: "form.placeholder.password",  value: "Mínimo 8 caracteres" },
    { key: "message.selectServiceFirst", value: "Elegí un servicio primero" },
    { key: "message.searchingSlots",     value: "Buscando turnos..." },
    { key: "message.noAvailability",     value: "Sin disponibilidad" },
    { key: "app.currency",       value: "EUR" },
    { key: "app.currencyLocale", value: "es-ES" },
    { key: "form.field.color",        value: "Color" },
    { key: "action.editService",      value: "Editar" },
    { key: "section.currency",        value: "Moneda" },
    { key: "section.currencySub",     value: "Moneda usada para mostrar precios en toda la app" },
    { key: "currency.label.ARS",      value: "Peso argentino" },
    { key: "currency.label.USD",      value: "Dólar estadounidense" },
    { key: "currency.label.COP",      value: "Peso colombiano" },
    { key: "currency.label.EUR",      value: "Euro" },
    { key: "error.createAppointment", value: "Error al crear el turno" },
    { key: "error.createClient",      value: "Error al crear el cliente" },
    { key: "validation.selectClient",     value: "Seleccioná un cliente" },
    { key: "validation.selectManicurist", value: "Seleccioná una profesional" },
    { key: "validation.selectService",    value: "Seleccioná un servicio" },
    { key: "validation.selectDateTime",   value: "Seleccioná fecha y hora" },
    { key: "validation.minLength",        value: "Mínimo 2 caracteres" },
    { key: "validation.invalidPhone",     value: "Teléfono inválido" },
    { key: "validation.invalidEmail",     value: "Email inválido" },
  ];

  for (const { key, value } of defaultSettings) {
    await prisma.appSetting.create({ data: { businessId, key, value } });
  }

  console.log("✅ Seed completo");
  console.log("─────────────────────────────────────");
  console.log("  OWNER:  bvittys@gmail.com    / 123vittyS");
  console.log("  ADMIN:  paolaLopez@gmail.com / Montecatini123");
  console.log("  MANI:   mafe@gmail.com        / 123mani");
  console.log("  MANI:   paola@gmail.com       / 123mani");
  console.log("  Empresa: Montecatini (slug: montecatini)");
  console.log("─────────────────────────────────────");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
