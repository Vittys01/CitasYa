/**
 * Gemini AI WhatsApp Bot Service
 *
 * Servicio que usa Google Gemini para manejar conversaciones de WhatsApp
 * de forma natural con function calling para operaciones de negocio.
 */

import { GoogleGenAI, type Content, type Part } from "@google/genai";
import { prisma } from "@/lib/db";
import { now, formatDate } from "@/lib/utils";
import { sendMessage } from "@/services/whatsapp-chat.service";
import { buildSystemPrompt } from "@/lib/gemini-prompt";
import { allToolDeclarations, executeTool, type ToolContext } from "@/lib/gemini-tools";

// ─── Config ────────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const SESSION_TIMEOUT_MINUTES = parseInt(process.env.WHATSAPP_BOT_TIMEOUT_MINUTES || "30", 10);
const MAX_HISTORY_TURNS = 20;
const MAX_FUNCTION_CALL_ITERATIONS = 5;

// ─── Gemini Client ─────────────────────────────────────────────────────────────

let genAI: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genAI) {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY no está configurada");
    }
    genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return genAI;
}

// ─── Session Types ──────────────────────────────────────────────────────────────

interface ConversationMessage {
  role: "user" | "model";
  text?: string;
  functionCalls?: Array<{ name: string; args: Record<string, unknown>; id?: string }>;
  functionResponses?: Array<{ name: string; response: unknown; id?: string }>;
}

interface GeminiSessionData {
  clientId?: string;
  clientName?: string;
  businessName?: string;
  history: ConversationMessage[];
  lastActivityAt: string;
}

// ─── Session Management ────────────────────────────────────────────────────────

async function getSession(businessId: string, phoneE164: string) {
  return prisma.whatsAppBotSession.findUnique({
    where: { businessId_phoneE164: { businessId, phoneE164 } },
  });
}

async function createSession(businessId: string, phoneE164: string) {
  return prisma.whatsAppBotSession.create({
    data: {
      businessId,
      phoneE164,
      step: "gemini",
      data: { history: [], lastActivityAt: new Date().toISOString() } as any,
    },
  });
}

async function updateSessionData(sessionId: string, data: GeminiSessionData) {
  await prisma.whatsAppBotSession.update({
    where: { id: sessionId },
    data: { data: data as any },
  });
}

function isSessionExpired(data: GeminiSessionData): boolean {
  if (!data.lastActivityAt) return true;
  const lastActivity = new Date(data.lastActivityAt).getTime();
  const timeoutMs = SESSION_TIMEOUT_MINUTES * 60 * 1000;
  return Date.now() - lastActivity > timeoutMs;
}

// ─── Client Resolution ─────────────────────────────────────────────────────────

async function getOrCreateClient(businessId: string, phoneE164: string) {
  let client = await prisma.client.findFirst({
    where: { businessId, phone: phoneE164 },
  });

  if (!client) {
    client = await prisma.client.create({
      data: {
        businessId,
        name: phoneE164,
        phone: phoneE164,
      },
    });
  }

  return client;
}

// ─── History Management ────────────────────────────────────────────────────────

function buildGeminiContents(history: ConversationMessage[]): Content[] {
  return history.map((msg) => {
    const parts: Part[] = [];

    if (msg.text) {
      parts.push({ text: msg.text });
    }

    if (msg.functionCalls) {
      for (const fc of msg.functionCalls) {
        parts.push({
          functionCall: { name: fc.name, args: fc.args, id: fc.id },
        });
      }
    }

    if (msg.functionResponses) {
      for (const fr of msg.functionResponses) {
        parts.push({
          functionResponse: {
            name: fr.name,
            response: fr.response as Record<string, unknown>,
            id: fr.id,
          },
        });
      }
    }

    return { role: msg.role as "user" | "model", parts };
  });
}

function trimHistory(history: ConversationMessage[]): ConversationMessage[] {
  if (history.length <= MAX_HISTORY_TURNS) return history;
  return history.slice(history.length - MAX_HISTORY_TURNS);
}

// ─── Main Entry Point ──────────────────────────────────────────────────────────

export async function handleGeminiWhatsAppMessage(
  businessId: string,
  phoneE164: string,
  text: string
): Promise<void> {
  console.log(`[GeminiBot] Message from ${phoneE164}: "${text}"`);

  // 1. Obtener o crear sesión
  let session = await getSession(businessId, phoneE164);
  if (!session) {
    session = await createSession(businessId, phoneE164);
  }

  const data: GeminiSessionData = (session.data as unknown as GeminiSessionData) || { history: [], lastActivityAt: new Date().toISOString() };
  if (!data.history) data.history = [];

  // 2. Check timeout
  if (isSessionExpired(data)) {
    console.log(`[GeminiBot] Session expired for ${phoneE164}, resetting`);
    data.history = [];
  }

  // 3. Obtener datos del negocio
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  });
  const businessName = data.businessName || business?.name || "nuestro salón";
  data.businessName = businessName;

  // 4. Resolver cliente
  const client = await getOrCreateClient(businessId, phoneE164);
  data.clientId = client.id;
  data.clientName = client.name !== phoneE164 ? client.name : undefined;

  // 5. Agregar mensaje del usuario al historial
  data.history.push({ role: "user", text });
  data.history = trimHistory(data.history);

  // 6. Construir prompt y contexto
  const currentTime = now();
  const systemPrompt = buildSystemPrompt({
    businessName,
    clientName: data.clientName,
    currentTime: `${formatDate(currentTime)} ${currentTime.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Atlantic/Canary" })}`,
  });

  const ctx: ToolContext = { businessId, phoneE164 };

  // 7. Llamar a Gemini con loop de function calling
  let responseText: string | null = null;

  try {
    const ai = getGenAI();
    const contents = buildGeminiContents(data.history);

    for (let iteration = 0; iteration < MAX_FUNCTION_CALL_ITERATIONS; iteration++) {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations: allToolDeclarations }],
        },
      });

      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        // Procesar function calls
        const modelParts: Part[] = [];
        const userResponseParts: Part[] = [];

        for (const fc of functionCalls) {
          console.log(`[GeminiBot] Function call: ${fc.name}(${JSON.stringify(fc.args)})`);

          // Agregar el function call del modelo al historial
          modelParts.push({ functionCall: { name: fc.name!, args: (fc.args ?? {}) as Record<string, unknown>, id: fc.id } });

          // Ejecutar la función
          let result: unknown;
          try {
            result = await executeTool(fc.name!, (fc.args ?? {}) as Record<string, unknown>, ctx);
          } catch (error: any) {
            console.error(`[GeminiBot] Error executing ${fc.name}:`, error);
            result = { error: error.message || "Error interno" };
          }

          // Agregar la respuesta de la función
          userResponseParts.push({
            functionResponse: {
              name: fc.name!,
              response: { result: JSON.parse(JSON.stringify(result)) } as Record<string, unknown>,
              id: fc.id,
            },
          });
        }

        // Guardar en historial
        data.history.push({ role: "model", functionCalls: functionCalls.map((fc) => ({ name: fc.name!, args: (fc.args ?? {}) as Record<string, unknown>, id: fc.id })) });
        data.history.push({ role: "user", functionResponses: functionCalls.map((fc, i) => ({ name: fc.name!, response: userResponseParts[i].functionResponse!.response, id: fc.id })) });

        // Agregar al contenido para la próxima iteración
        contents.push({ role: "model", parts: modelParts });
        contents.push({ role: "user", parts: userResponseParts });

        data.history = trimHistory(data.history);
      } else {
        // Respuesta de texto final
        responseText = response.text || null;
        break;
      }
    }

    if (!responseText) {
      responseText = "Lo siento, no pude procesar tu solicitud. ¿Podés intentar de nuevo?";
    }
  } catch (error: any) {
    console.error("[GeminiBot] Error calling Gemini:", error);

    if (error?.status === 429 || error?.message?.includes("quota") || error?.message?.includes("rate")) {
      responseText = "Dame un momentito, estoy con mucha consulta ahora 😅 Intentá en unos segundos.";
    } else {
      responseText = "Ups, tuve un problema técnico 😔 Intentá de nuevo en un momento o contactá directamente al salón.";
    }
  }

  // 8. Guardar respuesta en historial
  if (responseText) {
    data.history.push({ role: "model", text: responseText });
    data.history = trimHistory(data.history);
  }

  data.lastActivityAt = new Date().toISOString();

  // 9. Guardar sesión
  await updateSessionData(session.id, data);

  // 10. Enviar respuesta por WhatsApp
  if (responseText) {
    try {
      await sendMessage(businessId, phoneE164, responseText);
    } catch (sendError) {
      console.error("[GeminiBot] Error sending message:", sendError);
    }
  }
}
