"use client";

import { useState } from "react";

interface WhatsAppMessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export default function WhatsAppMessageInput({ onSend, disabled }: WhatsAppMessageInputProps) {
  const [content, setContent] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim() && !disabled) {
      onSend(content.trim());
      setContent("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4 bg-white border-t border-[#e6d5c3]">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
        placeholder="Escribe un mensaje..."
        disabled={disabled}
        rows={1}
        className="flex-1 px-4 py-2 bg-[#fbf6f1] border border-[#e6d5c3] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
      />
      <button
        type="submit"
        disabled={disabled || !content.trim()}
        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        <span className="material-symbols-outlined text-[20px]">send</span>
      </button>
    </form>
  );
}
