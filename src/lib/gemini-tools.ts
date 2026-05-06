/**
 * Gemini AI Tools — Function declarations and executors
 *
 * Define las herramientas que Gemini puede invocar y sus ejecutores.
 * Reutiliza los servicios existentes del proyecto.
 */

import { GoogleGenAI, Type, type FunctionDeclaration } from "@google/genai";
import { prisma } from "@/lib/db";
import { now, canaryDate, canaryDayBounds, formatTime, formatDate, getCanaryDateString } from "@/lib/utils";
import { getAvailableSlots, createAppointment, cancelAppointment } from "@/services/appointment.service";
import { format } from "date-fns";

// ─── Contexto pasado a los ejecutores ──────────────────────────────────────────

export interface ToolContext {
  businessId: string;
  phoneE164: string;
}

// ─── Function Declarations (schemas para Gemini) ──────────────────────────────

const getAvailableManicuristsDecl: FunctionDeclaration = {
  name: "get_available_manicurists",
  description: "Devuelve la lista de manicuristas/profesionales activas del negocio con sus nombres e IDs.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
};

const getServicesDecl: FunctionDeclaration = {
  name: "get_services",
  description: "Devuelve la lista de servicios del salón con precios, duración y descripción.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
};

const getAvailableSlotsDecl: FunctionDeclaration = {
  name: "get_available_slots",
  description: "Devuelve los horarios disponibles de una manicurista para una fecha específica. La fecha debe estar en formato YYYY-MM-DD y en zona horaria de Canarias.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      manicurist_id: { type: Type.STRING, description: "ID de la manicurista" },
      date: { type: Type.STRING, description: "Fecha en formato YYYY-MM-DD (zona Canarias)" },
      service_duration: { type: Type.NUMBER, description: "Duración del servicio en minutos (default: 60)" },
    },
    required: ["manicurist_id", "date"],
  },
};

const createAppointmentDecl: FunctionDeclaration = {
  name: "create_appointment",
  description: "Crea una nueva cita. El cliente se identifica automáticamente por su teléfono. IMPORTANTE: Confirma los detalles con el cliente ANTES de llamar esta función. start_at debe ser un ISO string en UTC.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      manicurist_id: { type: Type.STRING, description: "ID de la manicurista" },
      service_id: { type: Type.STRING, description: "ID del servicio" },
      start_at: { type: Type.STRING, description: "Fecha y hora de inicio en formato ISO 8601 UTC (ej: 2026-05-06T09:00:00.000Z)" },
    },
    required: ["manicurist_id", "service_id", "start_at"],
  },
};

const cancelAppointmentDecl: FunctionDeclaration = {
  name: "cancel_appointment",
  description: "Cancela una cita existente. IMPORTANTE: Muestra los detalles de la cita al cliente y pide confirmación ANTES de cancelar.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      appointment_id: { type: Type.STRING, description: "ID de la cita a cancelar" },
    },
    required: ["appointment_id"],
  },
};

const getClientAppointmentsDecl: FunctionDeclaration = {
  name: "get_client_appointments",
  description: "Devuelve las citas futuras del cliente identificado por su número de teléfono.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
};

const getCurrentTimeDecl: FunctionDeclaration = {
  name: "get_current_time",
  description: "Devuelve la fecha y hora actual en la zona horaria de las Islas Canarias (Atlantic/Canary). Úsalo para saber qué día es hoy, calcular fechas futuras, etc.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
};

export const allToolDeclarations: FunctionDeclaration[] = [
  getAvailableManicuristsDecl,
  getServicesDecl,
  getAvailableSlotsDecl,
  createAppointmentDecl,
  cancelAppointmentDecl,
  getClientAppointmentsDecl,
  getCurrentTimeDecl,
];

// ─── Tool Executors ────────────────────────────────────────────────────────────

async function executeGetAvailableManicurists(ctx: ToolContext) {
  const manicurists = await prisma.manicurist.findMany({
    where: { businessId: ctx.businessId, isActive: true },
    include: { user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  });

  return manicurists.map((m) => ({
    id: m.id,
    name: m.user.name,
  }));
}

async function executeGetServices(ctx: ToolContext) {
  const services = await prisma.service.findMany({
    where: { businessId: ctx.businessId, isActive: true },
    orderBy: { name: "asc" },
  });

  return services.map((s) => ({
    id: s.id,
    name: s.name,
    duration: s.duration,
    price: Number(s.price),
    description: s.description || undefined,
  }));
}

async function executeGetAvailableSlots(
  ctx: ToolContext,
  args: { manicurist_id: string; date: string; service_duration?: number }
) {
  const duration = args.service_duration || 60;
  const dateObj = canaryDate(args.date, 0, 0);

  const slots = await getAvailableSlots(args.manicurist_id, dateObj, duration);

  return slots.map((s) => ({
    start: s.start.toISOString(),
    start_time: formatTime(s.start),
    end: s.end.toISOString(),
    end_time: formatTime(s.end),
  }));
}

async function executeCreateAppointment(
  ctx: ToolContext,
  args: { manicurist_id: string; service_id: string; start_at: string }
) {
  // Resolver cliente por teléfono
  let client = await prisma.client.findFirst({
    where: { businessId: ctx.businessId, phone: ctx.phoneE164 },
  });

  if (!client) {
    // Crear cliente nuevo si no existe
    client = await prisma.client.create({
      data: {
        businessId: ctx.businessId,
        name: ctx.phoneE164, // Se actualizará cuando sepamos el nombre
        phone: ctx.phoneE164,
      },
    });
  }

  try {
    const appointment = await createAppointment({
      clientId: client.id,
      manicuristId: args.manicurist_id,
      serviceId: args.service_id,
      startAt: args.start_at,
      sendWhatsApp: false, // El bot ya está en la conversación, no enviar notificación extra
    });

    // Obtener relaciones para la respuesta
    const full = await prisma.appointment.findUnique({
      where: { id: appointment.id },
      include: {
        service: { select: { name: true, duration: true } },
        manicurist: { include: { user: { select: { name: true } } } },
      },
    });

    return {
      success: true,
      appointment: {
        id: appointment.id,
        date: full ? formatDate(full.startAt) : args.start_at,
        time: full ? formatTime(full.startAt) : "",
        service_name: full?.service.name ?? "",
        duration: full?.service.duration ?? 0,
        manicurist_name: full?.manicurist.user.name ?? "",
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "No se pudo crear la cita" };
  }
}

async function executeCancelAppointment(
  ctx: ToolContext,
  args: { appointment_id: string }
) {
  try {
    // Verificar que la cita pertenece a este negocio
    const appt = await prisma.appointment.findFirst({
      where: { id: args.appointment_id, businessId: ctx.businessId },
    });

    if (!appt) {
      return { success: false, error: "Cita no encontrada" };
    }

    await cancelAppointment(args.appointment_id);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "No se pudo cancelar la cita" };
  }
}

async function executeGetClientAppointments(ctx: ToolContext) {
  const client = await prisma.client.findFirst({
    where: { businessId: ctx.businessId, phone: ctx.phoneE164 },
  });

  if (!client) {
    return [];
  }

  const currentTime = now();
  const appointments = await prisma.appointment.findMany({
    where: {
      clientId: client.id,
      status: { in: ["PENDING", "CONFIRMED"] },
      startAt: { gte: currentTime },
    },
    include: {
      service: { select: { name: true, duration: true } },
      manicurist: { include: { user: { select: { name: true } } } },
    },
    orderBy: { startAt: "asc" },
    take: 10,
  });

  return appointments.map((a) => ({
    id: a.id,
    date: formatDate(a.startAt),
    time: formatTime(a.startAt),
    service_name: a.service.name,
    duration: a.service.duration,
    manicurist_name: a.manicurist.user.name,
    status: a.status,
  }));
}

function executeGetCurrentTime() {
  const currentTime = now();
  const dateStr = getCanaryDateString(currentTime);

  return {
    iso: currentTime.toISOString(),
    date: dateStr,
    time: formatTime(currentTime),
    day_of_week: formatDate(currentTime),
    timezone: "Atlantic/Canary",
  };
}

// ─── Tool Router ───────────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  switch (name) {
    case "get_available_manicurists":
      return executeGetAvailableManicurists(ctx);

    case "get_services":
      return executeGetServices(ctx);

    case "get_available_slots":
      return executeGetAvailableSlots(ctx, args as any);

    case "create_appointment":
      return executeCreateAppointment(ctx, args as any);

    case "cancel_appointment":
      return executeCancelAppointment(ctx, args as any);

    case "get_client_appointments":
      return executeGetClientAppointments(ctx);

    case "get_current_time":
      return executeGetCurrentTime();

    default:
      return { error: `Función desconocida: ${name}` };
  }
}
