"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import WhatsAppContactsList from "@/components/whatsapp/WhatsAppContactsList";
import WhatsAppChat from "@/components/whatsapp/WhatsAppChat";

export default function WhatsAppChatClientWrapper({
  businessId,
}: {
  businessId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedPhone = searchParams.get("contact");

  const [contacts, setContacts] = useState<any[]>([]);
  const [contact, setContact] = useState<any>(undefined);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Fetch contacts
  useEffect(() => {
    fetchContacts();
  }, [businessId]);

  // Fetch conversation when contact is selected
  useEffect(() => {
    if (selectedPhone) {
      fetchConversation(selectedPhone);
    } else {
      setContact(undefined);
      setMessages([]);
    }
  }, [selectedPhone, businessId]);

  const fetchContacts = async () => {
    try {
      setLoadingContacts(true);
      const res = await fetch(`/api/whatsapp/contacts?limit=100`);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("API Error fetching contacts:", res.status, errorText);
        throw new Error(`Error fetching contacts: ${res.status}`);
      }

      const data = await res.json();

      // Ensure data has the expected structure
      if (!data || typeof data !== 'object') {
        console.error("Invalid API response:", data);
        setContacts([]);
        return;
      }

      setContacts(data.contacts || []);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  };

  const fetchConversation = async (phoneE164: string) => {
    try {
      setLoadingMessages(true);
      const res = await fetch(
        `/api/whatsapp/conversations/${encodeURIComponent(phoneE164)}`
      );

      if (!res.ok) {
        const errorText = await res.text();
        console.error("API Error fetching conversation:", res.status, errorText);
        throw new Error(`Error fetching conversation: ${res.status}`);
      }

      const data = await res.json();

      // Ensure data has expected structure
      if (!data || typeof data !== 'object') {
        console.error("Invalid API response:", data);
        setContact(undefined);
        setMessages([]);
        return;
      }

      setContact(data.contact);
      setMessages(data.messages || []);
    } catch (error) {
      console.error("Error fetching conversation:", error);
      setContact(undefined);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!contact) return;

    try {
      const res = await fetch("/api/whatsapp/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneE164: contact.phoneE164,
          content,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("API Error sending message:", res.status, errorText);
        throw new Error(`Error sending message: ${res.status}`);
      }

      const data = await res.json();

      // Add sent message to the list
      if (data && data.message) {
        setMessages((prev) => [...prev, data.message]);

        // Refresh contacts to update last message
        fetchContacts();
      }
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  };

  const handleBack = () => {
    const searchParams = new URLSearchParams();
    searchParams.delete("contact");
    router.push(`/whatsapp?${searchParams.toString()}`);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Mobile view: show contacts or chat */}
      <div className="flex-1 flex md:hidden">
        {selectedPhone ? (
          <div className="flex-1 flex flex-col">
            <button
              onClick={handleBack}
              className="px-4 py-3 bg-white border-b border-[#e6d5c3] flex items-center gap-2 text-earth hover:bg-[#fbf6f1] transition"
            >
              <span className="material-symbols-outlined">arrow_back</span>
              <span className="text-sm font-medium">Volver</span>
            </button>
            <WhatsAppChat
              contact={contact}
              messages={messages}
              onSendMessage={handleSendMessage}
              loading={loadingMessages}
            />
          </div>
        ) : (
          <WhatsAppContactsList
            contacts={contacts}
            selectedPhone={selectedPhone || undefined}
            loading={loadingContacts}
          />
        )}
      </div>

      {/* Desktop view: show contacts and chat */}
      <div className="hidden md:flex flex-1">
        <WhatsAppContactsList
          contacts={contacts}
          selectedPhone={selectedPhone || undefined}
          loading={loadingContacts}
        />
        <WhatsAppChat
          contact={contact}
          messages={messages}
          onSendMessage={handleSendMessage}
          loading={loadingMessages}
        />
      </div>
    </div>
  );
}
