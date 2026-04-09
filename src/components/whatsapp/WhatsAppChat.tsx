"use client";

import { useEffect, useRef, useState } from "react";
import WhatsAppMessageBubble from "./WhatsAppMessageBubble";
import WhatsAppMessageInput from "./WhatsAppMessageInput";
import type { ConversationMessage, WhatsAppContact } from "@/services/whatsapp-chat.service";
import { formatPhoneNumber } from "@/lib/utils";

interface WhatsAppChatProps {
  contact: WhatsAppContact | undefined;
  messages: ConversationMessage[];
  onSendMessage: (content: string) => Promise<void>;
  loading?: boolean;
}

export default function WhatsAppChat({
  contact,
  messages,
  onSendMessage,
  loading,
}: WhatsAppChatProps) {
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    if (sending) return;

    setSending(true);
    try {
      await onSendMessage(content);
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Error al enviar mensaje. Por favor intenta nuevamente.");
    } finally {
      setSending(false);
    }
  };

  if (!contact) {
    return (
      <div className="flex-1 bg-[#EFEAE2] flex items-center justify-center">
        <div className="text-center text-[#bda696]">
          <span className="material-symbols-outlined text-6xl mb-3">
            chat_bubble_outline
          </span>
          <p className="text-lg font-medium">
            Selecciona una conversación
          </p>
          <p className="text-sm">
            Elige un contacto de la lista para ver el chat
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#EFEAE2]">
      {/* Chat Header */}
      <div className="px-4 py-3 bg-white border-b border-[#e6d5c3] flex items-center gap-3">
        {contact.avatar ? (
          <img
            src={contact.avatar}
            alt={contact.name || contact.phoneE164}
            className="w-10 h-10 rounded-full"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary-dark font-bold text-sm">
            {contact.name?.charAt(0).toUpperCase() || "#"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-earth truncate">
            {contact.name || formatPhoneNumber(contact.phoneE164)}
          </p>
          {contact.name && (
            <p className="text-xs text-[#bda696] truncate">
              {formatPhoneNumber(contact.phoneE164)}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-[#bda696]">Cargando mensajes...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <span className="material-symbols-outlined text-5xl text-[#bda696] mb-3">
              mark_email_read
            </span>
            <p className="text-[#bda696]">
              Sin mensajes aún
            </p>
            <p className="text-xs text-[#bda696] mt-1">
              Inicia la conversación enviando un mensaje
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <WhatsAppMessageBubble
                key={msg.id}
                direction={msg.direction}
                content={msg.content}
                status={msg.status}
                createdAt={msg.createdAt}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      <WhatsAppMessageInput
        onSend={handleSendMessage}
        disabled={sending}
      />
    </div>
  );
}
