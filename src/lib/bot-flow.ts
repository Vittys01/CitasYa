/**
 * WhatsApp Bot Flow Manager
 *
 * Gestiona los estados y transiciones del flujo conversacional del bot
 */

import type { WhatsAppBotSession } from "@prisma/client";
import type { ManicuristWithUser, Service } from "@/types";

// ─── Tipos de Estados del Flujo ────────────────────────────────────────────────

export type BotStep =
  | "idle"
  | "manicurist"
  | "service"
  | "date"
  | "slot"
  | "consulting"
  | "cancelling"
  | "custom_date";

export type BotCommand =
  | "MENU"
  | "AGENDAR"
  | "CITAS"
  | "CANCELAR"
  | "AYUDA"
  | "DISPONIBILIDAD";

// ─── Datos de Sesión del Bot ─────────────────────────────────────────────────────

export interface BotSessionData {
  // Selecciones temporales
  manicuristId?: string;
  manicuristName?: string;
  serviceId?: string;
  serviceName?: string;
  serviceDuration?: number;
  selectedDate?: string; // ISO string
  customDateInput?: string;
  selectedSlot?: { start: string; end: string };

  // Datos del cliente
  clientId?: string;
  clientName?: string;
  isNewClient?: boolean;

  // Metadatos
  businessId?: string;
  phoneE164?: string;

  // Index signature para compatibilidad con Prisma JsonValue
  [key: string]: any;
}

// ─── Parseo de Comandos ─────────────────────────────────────────────────────────

/**
 * Detecta si el texto es un comando y devuelve el tipo
 */
export function detectCommand(text: string): BotCommand | null {
  const normalized = text.toUpperCase().trim();

  const commands: Record<string, BotCommand> = {
    MENU: "MENU",
    AGENDAR: "AGENDAR",
    RESERVAR: "AGENDAR", // Sinónimo
    CITAS: "CITAS",
    TUS_CITAS: "CITAS", // Sinónimo
    MIS_CITAS: "CITAS", // Sinónimo
    CANCELAR: "CANCELAR",
    AYUDA: "AYUDA",
    HELP: "AYUDA", // Sinónimo
    DISPONIBILIDAD: "DISPONIBILIDAD",
    DISPONIBLE: "DISPONIBILIDAD", // Sinónimo
  };

  return commands[normalized] || null;
}

/**
 * Parsea el comando CANCELAR para extraer el número de cita
 */
export function parseCancelCommand(text: string): number | null {
  const match = text.match(/CANCELAR\s*(\d+)/i);
  if (match && match[1]) {
    const num = parseInt(match[1], 10);
    return !isNaN(num) && num > 0 ? num : null;
  }
  return null;
}

// ─── Gestión de Estados ─────────────────────────────────────────────────────────

/**
 * Determina si el estado actual permite procesar comandos globales
 */
export function canProcessGlobalCommand(step: BotStep): boolean {
  // Algunos estados bloquean comandos globales para evitar interrupciones
  return step !== "custom_date";
}

/**
 * Determina si el estado actual requiere una selección numérica
 */
export function requiresNumericSelection(step: BotStep): boolean {
  return (
    step === "manicurist" ||
    step === "service" ||
    step === "date" ||
    step === "slot"
  );
}

/**
 * Valida si el número de selección está dentro del rango válido
 */
export function validateSelectionNumber(
  selection: number,
  maxOptions: number
): boolean {
  return selection >= 1 && selection <= maxOptions;
}

// ─── Transiciones del Flujo ────────────────────────────────────────────────────

/**
 * Calcula el siguiente estado después de una acción válida
 */
export function getNextState(
  currentState: BotStep,
  action: "select" | "custom_date"
): BotStep {
  switch (currentState) {
    case "idle":
      return "manicurist";
    case "manicurist":
      return "service";
    case "service":
      return "date";
    case "date":
      if (action === "custom_date") return "custom_date";
      return "slot";
    case "custom_date":
      return "slot";
    case "slot":
      return "idle";
    case "consulting":
    case "cancelling":
      return "idle";
    default:
      return "idle";
  }
}

/**
 * Determina qué paso debe saltar cuando se selecciona una opción específica
 */
export function determineTargetStep(
  command: BotCommand,
  currentData: BotSessionData
): BotStep | null {
  switch (command) {
    case "AGENDAR":
      // Si ya tiene datos, intentar continuar desde el último paso
      if (currentData.manicuristId && currentData.serviceId) {
        if (currentData.selectedDate) return "slot";
        if (currentData.serviceId) return "date";
        return "service";
      }
      return "manicurist";
    case "CITAS":
      return "consulting";
    case "CANCELAR":
      return "cancelling";
    case "MENU":
    case "AYUDA":
    case "DISPONIBILIDAD":
      return "idle";
    default:
      return null;
  }
}

// ─── Gestión de Datos de Sesión ───────────────────────────────────────────────

/**
 * Crea una nueva estructura de datos de sesión
 */
export function createEmptySessionData(): BotSessionData {
  return {};
}

/**
 * Actualiza los datos de sesión con nueva información
 */
export function updateSessionData(
  currentData: BotSessionData,
  updates: Partial<BotSessionData>
): BotSessionData {
  return { ...currentData, ...updates };
}

/**
 * Limpia los datos temporales de la sesión (mantiene clientId y clientName)
 */
export function clearTemporarySessionData(data: BotSessionData): BotSessionData {
  const { clientId, clientName, isNewClient } = data;
  return { clientId, clientName, isNewClient };
}

/**
 * Restablece completamente los datos de sesión
 */
export function resetSessionData(): BotSessionData {
  return createEmptySessionData();
}

// ─── Utilidades para Listas ─────────────────────────────────────────────────────

/**
 * Convierte una selección de texto a índice numérico (0-based)
 */
export function textToIndex(text: string, options: string[]): number | null {
  const normalized = text.toLowerCase().trim();

  // Intentar como número
  const num = parseInt(text, 10);
  if (!isNaN(num) && num >= 1 && num <= options.length) {
    return num - 1; // Convertir a 0-based
  }

  // Intentar coincidencia por nombre
  const index = options.findIndex(
    (opt) => opt.toLowerCase() === normalized
  );
  return index >= 0 ? index : null;
}

/**
 * Extrae el índice numérico de un texto
 */
export function extractNumber(text: string): number | null {
  const match = text.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

// ─── Manejo de Fechas ───────────────────────────────────────────────────────────

/**
 * Parsea una fecha ingresada manualmente (formato día/mes)
 */
export function parseCustomDate(text: string): Date | null {
  // Soporta formatos: 15/04, 15-04, 15.04
  const match = text.match(/^(\d{1,2})[\/\-\.](\d{1,2})$/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);

  if (isNaN(day) || isNaN(month) || day < 1 || day > 31 || month < 1 || month > 12) {
    return null;
  }

  const now = new Date();
  const year = now.getFullYear();

  // Crear fecha en zona horaria del usuario (simple approximation)
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);

  // Si la fecha ya pasó, usar el próximo año
  if (date < now) {
    date.setFullYear(year + 1);
  }

  return date;
}

/**
 * Determina si una fecha es válida (no pasada)
 */
export function isValidFutureDate(date: Date): boolean {
  const now = new Date();
  // Considerar válida si es hoy o futuro
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const inputDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return inputDate >= today;
}

/**
 * Genera lista de fechas para selección
 */
export function generateDateOptions(
  baseDate: Date
): Array<{ label: string; date: Date; value: string }> {
  const options: Array<{ label: string; date: Date; value: string }> = [];

  // Hoy
  const today = new Date(baseDate);
  options.push({
    label: "Hoy",
    date: new Date(today),
    value: "today",
  });

  // Mañana
  const tomorrow = new Date(baseDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  options.push({
    label: "Mañana",
    date: tomorrow,
    value: "tomorrow",
  });

  // Próximos 7 días (opciones individuales)
  for (let i = 2; i < 7; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);

    // Formato: "Lunes 15"
    const dayName = date.toLocaleDateString("es-AR", { weekday: "long" });
    const dayNum = date.getDate();
    const label = `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${dayNum}`;

    options.push({
      label,
      date,
      value: date.toISOString(),
    });
  }

  return options;
}

// ─── Manejo de Opciones ────────────────────────────────────────────────────────

/**
 * Formatea lista de opciones para el bot
 */
export function formatOptionList(options: Array<{ name: string; subtitle?: string }>): string[] {
  return options.map((opt, index) => {
    let message = `${index + 1}. ${opt.name}`;
    if (opt.subtitle) {
      message += ` - ${opt.subtitle}`;
    }
    return message;
  });
}

/**
 * Busca opción por coincidencia parcial de texto
 */
export function findOptionByText<T extends { name: string }>(
  text: string,
  options: T[]
): T | null {
  const normalized = text.toLowerCase().trim();

  // Coincidencia exacta
  const exact = options.find((opt) => opt.name.toLowerCase() === normalized);
  if (exact) return exact;

  // Coincidencia parcial
  const partial = options.find((opt) =>
    opt.name.toLowerCase().includes(normalized)
  );
  if (partial) return partial;

  // Coincidencia por primera letra
  const firstLetter = options.find((opt) =>
    opt.name.toLowerCase().startsWith(normalized.charAt(0))
  );
  if (firstLetter) return firstLetter;

  return null;
}

// ─── Gestión de Timeout ─────────────────────────────────────────────────────────

/**
 * Determina si la sesión ha expirado
 */
export function hasSessionExpired(
  session: WhatsAppBotSession,
  timeoutMinutes: number = 30
): boolean {
  if (!session.updatedAt) return false;

  const now = new Date();
  const sessionTime = new Date(session.updatedAt);
  const elapsedMinutes = (now.getTime() - sessionTime.getTime()) / (1000 * 60);

  return elapsedMinutes > timeoutMinutes;
}

/**
 * Calcula el tiempo restante antes de la expiración
 */
export function getSessionRemainingTime(
  session: WhatsAppBotSession,
  timeoutMinutes: number = 30
): number | null {
  if (!session.updatedAt) return null;

  const now = new Date();
  const sessionTime = new Date(session.updatedAt);
  const elapsedMinutes = (now.getTime() - sessionTime.getTime()) / (1000 * 60);
  const remaining = timeoutMinutes - elapsedMinutes;

  return remaining > 0 ? remaining : 0;
}

// ─── Utilidades de Estado ──────────────────────────────────────────────────────

/**
 * Convierte el estado del flujo a descripción legible
 */
export function getStepDescription(step: BotStep): string {
  const descriptions: Record<BotStep, string> = {
    idle: "Menú principal",
    manicurist: "Seleccionando manicurista",
    service: "Seleccionando servicio",
    date: "Seleccionando fecha",
    slot: "Seleccionando horario",
    consulting: "Consultando citas",
    cancelling: "Cancelando cita",
    custom_date: "Ingresando fecha personalizada",
  };

  return descriptions[step] || step;
}

/**
 * Determina si el flujo está en proceso de agendado
 */
export function isBookingFlow(step: BotStep): boolean {
  return (
    step === "manicurist" ||
    step === "service" ||
    step === "date" ||
    step === "slot" ||
    step === "custom_date"
  );
}

/**
 * Determina si el flujo está activo (no en idle)
 */
export function isActiveFlow(step: BotStep): boolean {
  return step !== "idle";
}

// ─── Validación de Entradas ─────────────────────────────────────────────────────

/**
 * Valida si la entrada del usuario es un número válido
 */
export function isValidNumberInput(text: string): boolean {
  return /^\d+$/.test(text.trim());
}

/**
 * Extrae el índice de la entrada del usuario (1-based)
 */
export function extractSelectionIndex(text: string): number | null {
  const num = parseInt(text.trim(), 10);
  return !isNaN(num) && num > 0 ? num : null;
}

/**
 * Normaliza texto para comparación
 */
export function normalizeInputText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Remover acentos
}

// ─── Manejo de Errores de Flujo ───────────────────────────────────────────────

/**
 * Determina el tipo de error basado en el estado y la entrada
 */
export function classifyError(
  step: BotStep,
  input: string,
  maxOptions?: number
): "invalid_number" | "out_of_range" | "invalid_format" | "unknown" {
  const trimmed = input.trim();

  if (maxOptions !== undefined) {
    if (!isValidNumberInput(trimmed)) {
      return "invalid_format";
    }
    const num = parseInt(trimmed, 10);
    if (num < 1 || num > maxOptions) {
      return "out_of_range";
    }
  }

  if (step === "custom_date" && !parseCustomDate(trimmed)) {
    return "invalid_format";
  }

  return "unknown";
}

/**
 * Genera mensaje de error apropiado
 */
export function getErrorMessage(
  errorType: "invalid_number" | "out_of_range" | "invalid_format" | "unknown"
): string {
  const messages: Record<
    typeof errorType,
    string
  > = {
    invalid_number: "❌ Debes ingresar un número válido.",
    out_of_range: "❌ Opción no válida. Seleccioná un número de la lista.",
    invalid_format: "❌ Formato no válido. Por favor, seguí las instrucciones.",
    unknown: "❌ Ocurrió un error. Por favor, intentá nuevamente.",
  };

  return messages[errorType];
}
