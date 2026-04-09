"use client";

import { formatRelativeTime } from "@/lib/utils";
import type { Direction, MessageStatus } from "@prisma/client";

interface WhatsAppMessageBubbleProps {
  direction: Direction;
  content: string;
  status?: MessageStatus;
  createdAt: Date;
}

export default function WhatsAppMessageBubble({
  direction,
  content,
  status,
  createdAt,
}: WhatsAppMessageBubbleProps) {
  const isInbound = direction === "INBOUND";

  return (
    <div
      className={`flex ${isInbound ? "justify-start" : "justify-end"} mb-2`}
    >
      <div
        className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm ${
          isInbound
            ? "bg-white text-gray-900"
            : "bg-[#00A884] text-white"
        }`}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        <div className={`flex items-center justify-end gap-1 mt-1 ${isInbound ? "text-gray-400" : "text-white/70"}`}>
          <span className="text-[10px]">{formatRelativeTime(createdAt)}</span>
          {!isInbound && status && (
            <span className="material-symbols-outlined text-[10px]">
              {status === "SENT" ? "check" : status === "DELIVERED" ? "done_all" : "done_all"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
