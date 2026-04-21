/**
 * Servicio para gestión de conversaciones de WhatsApp
 * Maneja listado de contactos, conversaciones y envío de mensajes
 */

import { prisma } from "@/lib/db";
import { getWhatsAppProvider } from "@/lib/whatsapp";
import { now } from "@/lib/utils";
import type { Direction, MessageStatus } from "@prisma/client";

export interface WhatsAppMessage {
  id: string;
  phoneE164: string;
  direction: Direction;
  content: string;
  status: MessageStatus;
  externalId: string | null;
  metadata: any;
  createdAt: Date;
}

export interface WhatsAppContact {
  phoneE164: string;
  name?: string;
  avatar?: string;
  lastMessage: string;
  lastMessageTime: Date;
  messageCount: number;
}

export interface ConversationMessage {
  id: string;
  phoneE164: string;
  direction: Direction;
  content: string;
  status: MessageStatus;
  externalId: string | null;
  metadata: any;
  createdAt: Date;
}

/**
 * Obtiene lista de contactos únicos con mensajes
 */
export async function getContacts(
  businessId: string,
  query: string = "",
  page: number = 1,
  limit: number = 50
): Promise<{ contacts: WhatsAppContact[]; meta: any }> {
  const skip = (page - 1) * limit;

  // Buscar clientes que coinciden con la query
  const clients = await prisma.client.findMany({
    where: {
      businessId,
      OR: query
        ? [
            { name: { contains: query, mode: "insensitive" } },
            { phone: { contains: query } },
          ]
        : undefined,
    },
    select: { phone: true, name: true, email: true },
  });

  const phoneMap = new Map(
    clients.map((c) => [c.phone, { name: c.name, email: c.email }])
  );

  // Obtener mensajes con información de clientes
  const messages = await prisma.whatsAppMessage.findMany({
    where: {
      businessId,
      ...(query
        ? {
            OR: [
              { phoneE164: { contains: query } },
              ...(clients.length > 0
                ? [{ phoneE164: { in: clients.map((c) => c.phone) } }]
                : []),
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  // Agrupar por teléfono y encontrar el último mensaje
  const contactMap = new Map<string, any>();

  for (const msg of messages) {
    if (!contactMap.has(msg.phoneE164)) {
      const clientInfo = phoneMap.get(msg.phoneE164);
      contactMap.set(msg.phoneE164, {
        phoneE164: msg.phoneE164,
        name: clientInfo?.name,
        avatar: clientInfo?.email
          ? `https://www.gravatar.com/avatar/${Buffer.from(clientInfo.email.trim().toLowerCase()).toString("hex")}?d=retro`
          : undefined,
        lastMessage: msg.content,
        lastMessageTime: msg.createdAt,
        messageCount: 1,
      });
    } else {
      contactMap.get(msg.phoneE164).messageCount++;
    }
  }

  // Convertir a array y ordenar por último mensaje
  let contacts = Array.from(contactMap.values()).sort(
    (a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime()
  );

  // Paginar
  const total = contacts.length;
  contacts = contacts.slice(skip, skip + limit);

  return {
    contacts,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: skip + limit < total,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Obtiene conversación completa con un contacto específico
 */
export async function getConversation(
  businessId: string,
  phoneE164: string,
  page: number = 1,
  limit: number = 50
): Promise<{ messages: ConversationMessage[]; meta: any; contact?: WhatsAppContact }> {
  const skip = (page - 1) * limit;

  // Obtener información del contacto si existe en Client
  const client = await prisma.client.findFirst({
    where: {
      businessId,
      phone: phoneE164,
    },
    select: { name: true, email: true },
  });

  const contact: WhatsAppContact | undefined = client
    ? {
        phoneE164,
        name: client.name,
        avatar: client.email
          ? `https://www.gravatar.com/avatar/${Buffer.from(client.email.trim().toLowerCase()).toString("hex")}?d=retro`
          : undefined,
        lastMessage: "",
        lastMessageTime: now(),
        messageCount: 0,
      }
    : undefined;

  // Obtener mensajes
  const [messages, total] = await Promise.all([
    prisma.whatsAppMessage.findMany({
      where: {
        businessId,
        phoneE164,
      },
      orderBy: { createdAt: "asc" },
      skip,
      take: limit,
    }),
    prisma.whatsAppMessage.count({
      where: {
        businessId,
        phoneE164,
      },
    }),
  ]);

  return {
    messages: messages.map((msg) => ({
      id: msg.id,
      phoneE164: msg.phoneE164,
      direction: msg.direction,
      content: msg.content,
      status: msg.status,
      externalId: msg.externalId,
      metadata: msg.metadata,
      createdAt: msg.createdAt,
    })),
    contact,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: skip + limit < total,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Envía un nuevo mensaje de WhatsApp
 */
export async function sendMessage(
  businessId: string,
  phoneE164: string,
  content: string
): Promise<WhatsAppMessage> {
  const provider = getWhatsAppProvider();

  // Enviar mensaje por WhatsApp
  const result = await provider.sendText({
    to: phoneE164,
    body: content,
  });

  if (!result.success) {
    throw new Error(result.error || "Error al enviar mensaje");
  }

  // Guardar mensaje en BD
  const message = await prisma.whatsAppMessage.create({
    data: {
      businessId,
      phoneE164,
      direction: "OUTBOUND",
      content,
      status: "SENT",
      externalId: result.externalId,
      metadata: {
        provider: process.env.WHATSAPP_PROVIDER || "meta",
      },
    },
  });

  return {
    id: message.id,
    phoneE164: message.phoneE164,
    direction: message.direction,
    content: message.content,
    status: message.status,
    externalId: message.externalId,
    metadata: message.metadata,
    createdAt: message.createdAt,
  };
}

/**
 * Guarda un mensaje entrante de WhatsApp
 */
export async function saveIncomingMessage(
  businessId: string,
  phoneE164: string,
  content: string,
  metadata?: any,
  externalId?: string
): Promise<WhatsAppMessage> {
  const message = await prisma.whatsAppMessage.create({
    data: {
      businessId,
      phoneE164,
      direction: "INBOUND",
      content,
      status: "SENT",
      externalId,
      metadata,
    },
  });

  return {
    id: message.id,
    phoneE164: message.phoneE164,
    direction: message.direction,
    content: message.content,
    status: message.status,
    externalId: message.externalId,
    metadata: message.metadata,
    createdAt: message.createdAt,
  };
}

/**
 * Obtiene información de contacto si existe en Client
 */
export async function getContactInfo(
  businessId: string,
  phoneE164: string
): Promise<{ name?: string; email?: string; avatar?: string } | null> {
  const client = await prisma.client.findFirst({
    where: {
      businessId,
      phone: phoneE164,
    },
    select: { name: true, email: true },
  });

  if (!client) return null;

  return {
    name: client.name,
    email: client.email ?? undefined,
    avatar: client.email
      ? `https://www.gravatar.com/avatar/${Buffer.from(client.email.trim().toLowerCase()).toString("hex")}?d=retro`
      : undefined,
  };
}
