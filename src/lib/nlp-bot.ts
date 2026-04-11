/**
 * WhatsApp Bot NLP Module
 *
 * Módulo de procesamiento de lenguaje natural para el bot de WhatsApp.
 * Permite análisis fuzzy de texto, extracción de entidades y detección de intenciones.
 */

import { addDays, format, parse, isValid, startOfDay, endOfDay, differenceInDays, differenceInHours, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { toCanaryTimezone } from "./utils";

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export interface NLPIntent {
  type: "booking" | "viewing" | "cancelling" | "availability" | "help" | "menu" | "greeting" | "goodbye" | "confirmation" | "negation" | "back" | "change" | "unknown";
  confidence: number; // 0-1
  entities: NLPEntities;
}

export interface NLPEntities {
  dates?: Date[];
  times?: string[];
  quantities?: number[];
  manicurists?: string[];
  services?: string[];
  phoneNumbers?: string[];
  names?: string[];
  numbers?: number[];
}

export interface NLPMatchResult {
  matched: boolean;
  confidence: number;
  value?: string | number | Date;
  metadata?: Record<string, any>;
}

// ─── Constantes de Patrones ───────────────────────────────────────────────

// Palabras clave para intenciones
const INTENT_KEYWORDS = {
  booking: [
    "agendar", "reservar", "reserva", "cita", "turno", "programar",
    "quiero", "necesito", "quieres", "gustar", "gustaría",
    "disponible", "libre", "tiene", "tengo", "hay",
    "próximo", "próxima", "siguiente", "después",
    "sí", "si", "claro", "ok", "perfecto", "genial",
    "1", "uno", "agenda", "reserva"
  ],
  viewing: [
    "ver", "consulta", "mis", "tengo", "tengo agendado", "mis citas",
    "tengo turno", "mis turnos", "agendado", "programado",
    "próximos", "futuros", "confirmados", "pendientes",
    "2", "dos", "mis", "ver"
  ],
  cancelling: [
    "cancelar", "cancela", "cancel", "anular", "borrar",
    "eliminar", "quitar", "no voy a ir", "no puedo",
    "descartar", "deshacer", "anular reserva",
    "3", "tres", "cancela"
  ],
  availability: [
    "disponibilidad", "disponible", "libre", "horarios",
    "cuándo", "cuando", "qué hora", "a qué hora",
    "horario", "horarios", "cuando esta", "cuando está"
  ],
  help: [
    "ayuda", "help", "comandos", "instrucciones", "cómo",
    "como funciona", "qué", "qué opciones", "guía"
  ],
  menu: [
    "menú", "menu", "opciones", "volver", "inicio",
    "empezar", "de nuevo", "nuevo", "reiniciar"
  ],
  greeting: [
    "hola", "buen día", "buenos días", "buenas tardes",
    "buenas noches", "qué tal", "qué onda", "qué hay",
    "hi", "hey", "saludos", "buen día"
  ],
  goodbye: [
    "chau", "adiós", "adios", "bye", "hasta luego",
    "nos vemos", "hasta", "ya fue", "gracias", "muchas gracias"
  ],
  confirmation: [
    "sí", "si", "claro", "claro que sí", "por supuesto",
    "obvio", "lógico", "perfecto", "genial", "excelente",
    "acepto", "confirmo", "ok", "vale", "de acuerdo",
    "afirmativo", "positivo", "exacto", "correcto"
  ],
  negation: [
    "no", "no quiero", "no me interesa", "no gracias",
    "cancelar", "anular", "deshacer", "descartar",
    "no es", "no parece", "incorrecto", "error", "mal"
  ],
  back: [
    "volver", "atras", "atrás", "anterior", "previo",
    "regresar", "retornar", "salir", "menú"
  ],
  change: [
    "cambiar", "modificar", "editar", "alterar",
    "ajustar", "corregir", "otro", "distinto",
    "no ese", "no este", "otra vez"
  ]
};

// Patrones de fecha en español
const DATE_PATTERNS = [
  // Referencias relativas
  { pattern: /\b(hoy)\b/i, type: "today" },
  { pattern: /\b(mañana|mañana)\b/i, type: "tomorrow" },
  { pattern: /\b(pasado mañana)\b/i, type: "after_tomorrow" },
  { pattern: /\b(est[áa] semana|esta semana)\b/i, type: "this_week" },
  { pattern: /\b(la semana que viene|pr[óo]xima semana|siguiente semana)\b/i, type: "next_week" },
  { pattern: /\b(est[áa] mes|este mes)\b/i, type: "this_month" },
  { pattern: /\b(el mes que viene|pr[óo]ximo mes|siguiente mes)\b/i, type: "next_month" },

  // Días de la semana
  { pattern: /\b(lunes|lun|lun)\b/i, type: "weekday", value: 1 },
  { pattern: /\b(martes|mart|mar)\b/i, type: "weekday", value: 2 },
  { pattern: /\b(mi[ée]rcoles|mie|mi[eé]r)\b/i, type: "weekday", value: 3 },
  { pattern: /\b(jueves|jue)\b/i, type: "weekday", value: 4 },
  { pattern: /\b(viernes|vie)\b/i, type: "weekday", value: 5 },
  { pattern: /\b(s[áa]bado|sab|s[áa]b)\b/i, type: "weekday", value: 6 },
  { pattern: /\b(domingo|dom)\b/i, type: "weekday", value: 0 },

  // Formatos de fecha específicos
  { pattern: /\b(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?\b/, type: "specific_date" },

  // Referencias temporales
  { pattern: /\b(ahora|ya|en este momento)\b/i, type: "now" },
  { pattern: /\b(m[áa]s tarde|en la tarde)\b/i, type: "afternoon" },
  { pattern: /\b(esta noche|por la noche)\b/i, type: "evening" },
  { pattern: /\b(mañana temprano|temprano)\b/i, type: "early_morning" },
];

// Patrones de hora
const TIME_PATTERNS = [
  { pattern: /\b(\d{1,2}):(\d{2})\s*([ap]m)\b/i, type: "12hour" },
  { pattern: /\b(\d{1,2})\s*([ap]m)\b/i, type: "12hour_short" },
  { pattern: /\b(\d{1,2}):(\d{2})\s*(hrs|horas|h)\b/i, type: "24hour" },
  { pattern: /\b(\d{1,2})\s*(hrs|horas|h)\b/i, type: "24hour_short" },

  // Referencias relativas de hora
  { pattern: /\b(pronto|ahorita|un momento)\b/i, type: "soon" },
  { pattern: /\b(m[áa]s o menos|en breve|rato)\b/i, type: "soon" },
];

// ─── Funciones de Análisis de Texto ─────────────────────────────────────────────

/**
 * Normaliza el texto para análisis
 */
function normalizeForAnalysis(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Eliminar acentos para mejor comparación
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Eliminar caracteres especiales excepto letras, números y espacios
    .replace(/[^\w\s]/g, " ")
    // Eliminar espacios múltiples
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calcula la similitud entre dos textos (Levenshtein distance)
 */
function calculateSimilarity(text1: string, text2: string): number {
  const normalized1 = normalizeForAnalysis(text1);
  const normalized2 = normalizeForAnalysis(text2);

  if (normalized1 === normalized2) return 1;

  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);

  return 1 - distance / maxLength;
}

/**
 * Distancia de Levenshtein entre dos strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }

  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],
          dp[i][j - 1],
          dp[i - 1][j - 1]
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Busca la mejor coincidencia en una lista de opciones
 */
function findBestMatch(
  query: string,
  options: string[],
  threshold: number = 0.7
): NLPMatchResult {
  const normalizedQuery = normalizeForAnalysis(query);
  let bestMatch: NLPMatchResult = {
    matched: false,
    confidence: 0,
  };

  for (const option of options) {
    const similarity = calculateSimilarity(normalizedQuery, normalizeForAnalysis(option));

    if (similarity > bestMatch.confidence && similarity >= threshold) {
      bestMatch = {
        matched: true,
        confidence: similarity,
        value: option,
      };
    }
  }

  return bestMatch;
}

/**
 * Busca múltiples coincidencias en una lista de opciones
 */
function findAllMatches(
  query: string,
  options: string[],
  threshold: number = 0.6
): NLPMatchResult[] {
  const results: NLPMatchResult[] = [];

  for (const option of options) {
    const similarity = calculateSimilarity(query, normalizeForAnalysis(option));

    if (similarity >= threshold) {
      results.push({
        matched: true,
        confidence: similarity,
        value: option,
      });
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Detecta la intención principal del texto
 */
function detectIntent(text: string): NLPIntent {
  const normalized = normalizeForAnalysis(text);
  const words = normalized.split(/\s+/);

  // Buscar coincidencias por palabras clave
  const intentScores: Record<string, number> = {};

  for (const word of words) {
    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
      for (const keyword of keywords) {
        const keywordNormalized = normalizeForAnalysis(keyword);

        if (word === keywordNormalized) {
          intentScores[intent] = (intentScores[intent] || 0) + 1.0;
        } else if (word.includes(keywordNormalized) || keywordNormalized.includes(word)) {
          intentScores[intent] = (intentScores[intent] || 0) + 0.5;
        }
      }
    }
  }

  // Determinar la intención con mayor puntaje
  let maxScore = 0;
  let primaryIntent: NLPIntent["type"] = "unknown";

  for (const [intent, score] of Object.entries(intentScores)) {
    if (score > maxScore) {
      maxScore = score;
      primaryIntent = intent as NLPIntent["type"];
    }
  }

  // Extraer entidades del texto
  const entities = extractEntities(text);

  return {
    type: primaryIntent,
    confidence: Math.min(maxScore / words.length, 1),
    entities,
  };
}

/**
 * Extrae entidades del texto (fechas, horas, números, etc.)
 */
function extractEntities(text: string): NLPEntities {
  const entities: NLPEntities = {};

  // Extraer fechas
  entities.dates = extractDates(text);

  // Extraer horas
  entities.times = extractTimes(text);

  // Extraer números
  entities.numbers = extractNumbers(text);

  // Extraer nombres de manicurista (patrones comunes)
  entities.manicurists = extractNames(text);

  // Extraer nombres de servicio (palabras clave)
  entities.services = extractServiceKeywords(text);

  return entities;
}

// ─── Extracción de Fechas ─────────────────────────────────────────────────────

/**
 * Extrae fechas del texto
 */
function extractDates(text: string): Date[] {
  const dates: Date[] = [];
  const now = toCanaryTimezone(new Date());

  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern.pattern);
    if (!match) continue;

    let date: Date | null = null;

    switch (pattern.type) {
      case "today":
        date = new Date(now);
        break;

      case "tomorrow":
        date = addDays(now, 1);
        break;

      case "after_tomorrow":
        date = addDays(now, 2);
        break;

      case "this_week":
        date = addDays(now, 0);
        break;

      case "next_week":
        date = addDays(now, 7);
        break;

      case "this_month":
        date = addDays(now, 0);
        break;

      case "next_month":
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        date = nextMonth;
        break;

      case "weekday":
        const weekday = pattern.value || 0;
        const targetDay = new Date(now);
        const currentDay = targetDay.getDay();

        let daysToAdd = (weekday - currentDay + 7) % 7;
        if (daysToAdd === 0 && isSameDay(targetDay, now)) {
          daysToAdd = 7; // Si ya es ese día, usar la próxima semana
        }

        targetDay.setDate(targetDay.getDate() + daysToAdd);
        date = targetDay;
        break;

      case "specific_date":
        try {
          const [day, month, year] = match!.slice(1, 4).map(Number);

          if (!isNaN(day) && !isNaN(month)) {
            const constructedDate = new Date(
              year || now.getFullYear(),
              month - 1,
              day
            );

            if (isValid(constructedDate)) {
              // Si el año es el actual y la fecha ya pasó, usar el próximo año
              if (!year && constructedDate < now) {
                constructedDate.setFullYear(constructedDate.getFullYear() + 1);
              }

              date = constructedDate;
            }
          }
        } catch (error) {
          console.error("Error parsing specific date:", error);
        }
        break;

      case "now":
        date = new Date(now);
        break;

      case "afternoon":
        const afternoon = new Date(now);
        afternoon.setHours(14, 0, 0, 0);
        date = afternoon;
        break;

      case "evening":
        const evening = new Date(now);
        evening.setHours(20, 0, 0, 0);
        date = evening;
        break;

      case "early_morning":
        const earlyMorning = new Date(now);
        earlyMorning.setHours(8, 0, 0, 0);
        date = earlyMorning;
        break;
    }

    if (date) {
      // Validar que sea una fecha futura
      if (isValid(date) && date >= startOfDay(now)) {
        dates.push(date);
      }
    }
  }

  return [...new Set(dates.map(d => d.toISOString()))].map(iso => new Date(iso));
}

/**
 * Extrae horas del texto
 */
function extractTimes(text: string): string[] {
  const times: string[] = [];

  for (const pattern of TIME_PATTERNS) {
    const match = text.match(pattern.pattern);
    if (!match) continue;

    let timeString = "";

    switch (pattern.type) {
      case "12hour":
        const [hours, minutes, period] = match!.slice(1);
        let hour = parseInt(hours, 10);
        const min = parseInt(minutes, 10);

        if (period.toLowerCase() === "pm" && hour !== 12) {
          hour += 12;
        } else if (period.toLowerCase() === "am" && hour === 12) {
          hour = 0;
        }

        timeString = `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
        break;

      case "12hour_short":
        const [h, p] = match!.slice(1);
        let h12 = parseInt(h, 10);

        if (p.toLowerCase() === "pm" && h12 !== 12) {
          h12 += 12;
        } else if (p.toLowerCase() === "am" && h12 === 12) {
          h12 = 0;
        }

        timeString = `${h12.toString().padStart(2, "0")}:00`;
        break;

      case "24hour":
        const [h24, m24] = match!.slice(1);
        timeString = `${h24.toString().padStart(2, "0")}:${m24.toString().padStart(2, "0")}`;
        break;

      case "24hour_short":
        const [h24s] = match!.slice(1);
        timeString = `${h24s.toString().padStart(2, "0")}:00`;
        break;

      case "soon":
        timeString = "pronto";
        break;
    }

    if (timeString) {
      times.push(timeString);
    }
  }

  return [...new Set(times)];
}

/**
 * Extrae números del texto
 */
function extractNumbers(text: string): number[] {
  const numbers: number[] = [];
  const matches = text.match(/\b(\d+)\b/g);

  if (matches) {
    for (const match of matches) {
      const num = parseInt(match, 10);
      if (!isNaN(num)) {
        numbers.push(num);
      }
    }
  }

  return numbers;
}

/**
 * Extrae posibles nombres de manicurista del texto
 */
function extractNames(text: string): string[] {
  const words = text.split(/\s+/);
  const names: string[] = [];

  // Palabras que podrían ser nombres (empiezan con mayúscula)
  const potentialNames = words.filter(word =>
    /^[A-ZÁÉÍÓÚ][a-záéíóúñ\s]+$/.test(word)
  );

  return [...new Set(potentialNames)];
}

/**
 * Extrae palabras clave de servicio del texto
 */
function extractServiceKeywords(text: string): string[] {
  const keywords: string[] = [];

  const serviceKeywords = [
    "manicura", "uñas", "esculpidas", "gel", "acrilico",
    "diseño", "arte", "decoración", "french", "spañish",
    "pedicura", "pies", "calzado", "spa", "masaje",
    "tratamiento", "cuidado", "hidratación", "peeling"
  ];

  const normalizedText = normalizeForAnalysis(text);

  for (const keyword of serviceKeywords) {
    if (normalizedText.includes(normalizeForAnalysis(keyword))) {
      keywords.push(keyword);
    }
  }

  return [...new Set(keywords)];
}

// ─── Análisis de Selecciones ───────────────────────────────────────────────────

/**
 * Analiza una selección del usuario contra opciones disponibles
 */
function analyzeSelection(
  userInput: string,
  availableOptions: Array<{ name: string; id: string; index: number }>,
  threshold: number = 0.6
): NLPMatchResult | null {
  // Primero, intentar coincidencia exacta de número
  const numberMatch = userInput.match(/^\d+$/);
  if (numberMatch) {
    const num = parseInt(numberMatch[0], 10);
    const option = availableOptions.find(opt => opt.index === num);

    if (option) {
      return {
        matched: true,
        confidence: 1.0,
        value: option.id,
        metadata: { type: "number", number: num },
      };
    }
  }

  // Segundo, buscar coincidencia fuzzy por nombre
  const optionNames = availableOptions.map(opt => opt.name);
  const bestMatch = findBestMatch(userInput, optionNames, threshold);

  if (bestMatch.matched) {
    const option = availableOptions.find(opt => opt.name === bestMatch.value);
    return {
      matched: true,
      confidence: bestMatch.confidence,
      value: option?.id,
      metadata: {
        type: "fuzzy",
        matchedName: bestMatch.value,
      },
    };
  }

  return null;
}

// ─── Contexto y Memoria ───────────────────────────────────────────────────────

/**
 * Extrae contexto de historial de conversación
 */
export interface ConversationContext {
  lastIntent?: NLPIntent["type"];
  mentionedEntities?: NLPEntities;
  previousSelections?: Record<string, string>;
  clarificationNeeded?: boolean;
}

/**
 * Analiza el contexto de la conversación
 */
function analyzeConversationContext(
  currentInput: string,
  previousIntent?: NLPIntent,
  previousEntities?: NLPEntities
): ConversationContext {
  const currentIntent = detectIntent(currentInput);
  const context: ConversationContext = {
    lastIntent: currentIntent.type,
    mentionedEntities: currentIntent.entities,
  };

  // Si la intención es negativa, podría ser rechazo o cancelación
  if (currentIntent.type === "negation") {
    context.clarificationNeeded = true;
  }

  // Si hay cambios o modificaciones, mantener contexto previo
  if (currentIntent.type === "change" && previousIntent) {
    context.lastIntent = previousIntent.type;
  }

  return context;
}

/**
 * Genera preguntas de aclaración
 */
function generateClarificationQuestion(
  missingEntities: string[],
  context: ConversationContext
): string {
  if (missingEntities.length === 0) return "";

  const questions: string[] = [];

  if (missingEntities.includes("manicurist")) {
    questions.push("¿Con qué manicurista querés agendar?");
  }

  if (missingEntities.includes("service")) {
    questions.push("¿Qué servicio te gustaría?");
  }

  if (missingEntities.includes("date")) {
    questions.push("¿Para qué día preferís?");
  }

  if (missingEntities.includes("time")) {
    questions.push("¿A qué hora te quedaría bien?");
  }

  if (questions.length > 0) {
    return `🤔 Para ayudarte mejor, necesito saber:\n${questions.join("\n")}`;
  }

  return "";
}

// ─── Procesamiento de Lenguaje Natural Complejo ────────────────────────────────

/**
 * Procesa frases complejas con múltiples entidades
 */
function processComplexQuery(
  text: string,
  availableOptions: {
    manicurists: string[];
    services: string[];
  }
): {
  intent: NLPIntent["type"];
  entities: NLPEntities;
  extractedSelections: {
    manicurist?: string;
    service?: string;
    date?: Date;
    time?: string;
  };
} {
  const intent = detectIntent(text);
  const entities = extractEntities(text);
  const extracted: any = {};

  // Buscar coincidencia de manicurista
  if (entities.manicurists && entities.manicurists.length > 0) {
    const manicuristMatch = findBestMatch(
      entities.manicurists[0],
      availableOptions.manicurists
    );
    if (manicuristMatch.matched) {
      extracted.manicurist = manicuristMatch.value as string;
    }
  }

  // Buscar coincidencia de servicio
  if (entities.services && entities.services.length > 0) {
    const serviceMatch = findBestMatch(
      entities.services[0],
      availableOptions.services
    );
    if (serviceMatch.matched) {
      extracted.service = serviceMatch.value as string;
    }
  }

  // Extraer fecha y hora
  if (entities.dates && entities.dates.length > 0) {
    extracted.date = entities.dates[0];
  }

  if (entities.times && entities.times.length > 0) {
    extracted.time = entities.times[0];
  }

  return {
    intent: intent.type,
    entities,
    extractedSelections: extracted,
  };
}

// ─── Exportaciones ─────────────────────────────────────────────────────────────

export {
  normalizeForAnalysis,
  calculateSimilarity,
  findBestMatch,
  findAllMatches,
  detectIntent,
  extractEntities,
  extractDates,
  extractTimes,
  extractNumbers,
  extractNames,
  extractServiceKeywords,
  analyzeSelection,
  analyzeConversationContext,
  generateClarificationQuestion,
  processComplexQuery,
};
