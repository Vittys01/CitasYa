"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { formatRelativeTime } from "@/lib/utils";
import type { WhatsAppContact } from "@/services/whatsapp-chat.service";
import { cn } from "@/lib/utils";

interface WhatsAppContactsListProps {
  contacts: WhatsAppContact[];
  selectedPhone?: string;
  loading?: boolean;
}

export default function WhatsAppContactsList({
  contacts,
  selectedPhone,
  loading,
}: WhatsAppContactsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSelectContact = (phoneE164: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("contact", phoneE164);
    router.push(`/whatsapp?${params.toString()}`);
  };

  return (
    <div className="w-full md:w-[320px] bg-white border-r border-[#e6d5c3] flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#e6d5c3]">
        <h2 className="font-semibold text-earth">Mensajes</h2>
        <p className="text-sm text-[#bda696]">
          {contacts.length} {contacts.length === 1 ? "contacto" : "contactos"}
        </p>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-[#bda696]">Cargando...</div>
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <span className="material-symbols-outlined text-4xl text-[#bda696] mb-2">
              chat_bubble_outline
            </span>
            <p className="text-sm text-[#bda696]">No hay conversaciones aún</p>
            <p className="text-xs text-[#bda696] mt-1">
              Los mensajes de tus clientes aparecerán aquí
            </p>
          </div>
        ) : (
          contacts.map((contact) => (
            <button
              key={contact.phoneE164}
              onClick={() => handleSelectContact(contact.phoneE164)}
              className={cn(
                "w-full px-4 py-3 flex items-center gap-3 hover:bg-[#fbf6f1] transition text-left border-b border-[#f0ede8]",
                selectedPhone === contact.phoneE164 && "bg-[#fbf6f1]"
              )}
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary-dark font-bold text-sm flex-shrink-0">
                {contact.avatar ? (
                  <img
                    src={contact.avatar}
                    alt={contact.name || contact.phoneE164}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <span>
                    {contact.name?.charAt(0).toUpperCase() || "#"}
                  </span>
                )}
              </div>

              {/* Contact Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-earth truncate">
                    {contact.name || contact.phoneE164}
                  </p>
                  <span className="text-[10px] text-[#bda696] whitespace-nowrap">
                    {formatRelativeTime(contact.lastMessageTime)}
                  </span>
                </div>
                <p className="text-xs text-[#bda696] truncate">
                  {contact.lastMessage}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
