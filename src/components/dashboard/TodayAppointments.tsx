"use client";

import { useState } from "react";
import { formatTime } from "@/lib/utils";
import { formatPrice } from "@/lib/format-price";
import type { AppointmentForClient } from "@/lib/serialize";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { icon: string; label: string; bg: string; text: string; border: string }> = {
  PENDING:   { icon: "schedule",      label: "Pendiente",   bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200" },
  CONFIRMED: { icon: "check_circle",   label: "Confirmado",  bg: "bg-blue-50",     text: "text-blue-700",    border: "border-blue-200" },
  COMPLETED: { icon: "task_alt",       label: "Completado",  bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200" },
  CANCELLED: { icon: "cancel",         label: "Cancelado",   bg: "bg-gray-50",     text: "text-gray-500",    border: "border-gray-200" },
};

const get = (s: Record<string, string> | undefined, k: string, fallback: string) => (s && s[k]) ?? fallback;

interface TodayAppointmentsProps {
  appointments: AppointmentForClient[];
  settings?: Record<string, string>;
}

export default function TodayAppointments({ appointments, settings }: TodayAppointmentsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = [...appointments].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

  const title = get(settings, "dashboard.todayTitle", "Turnos de hoy");
  const toggle = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  return (
    <div className="bg-[#FFFDF5] rounded-xl border border-[#e6d5c3] p-5 shadow-warm-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-earth">{title}</h2>
          <p className="text-xs text-earth-muted mt-0.5">
            {sorted.length} {get(settings, "dashboard.todaySub", "programados")}
          </p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary-dark text-[18px]">today</span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-[#bda696] py-8">
          <span className="material-symbols-outlined text-4xl mb-2">event_available</span>
          <p className="text-sm">
            {get(settings, "dashboard.noAppts", "Sin turnos para hoy")}
          </p>
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto flex-1 no-scrollbar pr-1">
          {sorted.map((appt) => {
            const cfg = statusConfig[appt.status] ?? statusConfig.PENDING;
            const isExpanded = expandedId === appt.id;
            const multi = appt.services && appt.services.length > 1;
            const duration = Math.round(
              (new Date(appt.endAt).getTime() - new Date(appt.startAt).getTime()) / 60000
            );

            return (
              <div
                key={appt.id}
                className={cn(
                  "rounded-lg border transition-all",
                  isExpanded ? "border-[#d7ccc8] bg-white" : "border-transparent hover:border-[#e6d5c3]"
                )}
              >
                <button
                  type="button"
                  onClick={() => toggle(appt.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-cream-dark/60 transition text-left"
                >
                  <div className="flex-shrink-0 text-center w-14 py-1.5 rounded-lg bg-cream-dark">
                    <p className="text-sm font-bold text-earth leading-tight">
                      {formatTime(new Date(appt.startAt))}
                    </p>
                    <p className="text-[10px] text-earth-muted mt-0.5">{duration} min</p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: appt.manicurist.color ?? "#8D6E63" }}
                      >
                        {appt.client.name.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-sm font-semibold text-earth truncate">{appt.client.name}</p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: appt.service.color ?? "#bda696" }}
                      />
                      <p className="text-xs text-earth-muted truncate">{appt.service.name}</p>
                      {multi && (
                        <span className="text-[10px] text-primary-dark font-medium flex-shrink-0">
                          +{appt.services!.length - 1}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full border font-medium",
                        cfg.bg, cfg.text, cfg.border
                      )}
                    >
                      {cfg.label}
                    </span>
                    <span className="text-xs font-semibold text-earth">
                      {formatPrice(Number(appt.price), settings)}
                    </span>
                  </div>

                  <span
                    className={cn(
                      "material-symbols-outlined text-[#bda696] text-lg transition-transform duration-200 flex-shrink-0",
                      isExpanded && "rotate-180"
                    )}
                  >
                    expand_more
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-[#f0ede8]">
                    <div className="space-y-2 text-sm pt-2">
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-[16px] text-earth-muted flex-shrink-0">
                          person
                        </span>
                        <span className="text-earth font-medium">{appt.client.name}</span>
                        {appt.client.phone && (
                          <a
                            href={`tel:${appt.client.phone}`}
                            className="text-primary-dark hover:underline text-xs ml-auto flex-shrink-0"
                          >
                            {appt.client.phone}
                          </a>
                        )}
                      </div>

                      <div className="flex items-start gap-2.5">
                        <span className="material-symbols-outlined text-[16px] text-earth-muted flex-shrink-0 mt-0.5">
                          spa
                        </span>
                        <div className="flex-1 min-w-0 space-y-1">
                          {multi && appt.services ? (
                            appt.services.map((s, i) => (
                              <div key={i} className="flex justify-between items-center gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: s.service.color ?? "#bda696" }}
                                  />
                                  <span className="text-earth text-xs truncate">{s.service.name}</span>
                                  {s.durationMinutes && (
                                    <span className="text-earth-muted text-[10px] flex-shrink-0">
                                      {s.durationMinutes}m
                                    </span>
                                  )}
                                </div>
                                <span className="text-earth-muted text-xs flex-shrink-0">
                                  {formatPrice(Number(s.price), settings)}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: appt.service.color ?? "#bda696" }}
                                />
                                <span className="text-earth text-xs">{appt.service.name}</span>
                                <span className="text-earth-muted text-[10px]">
                                  {appt.service.duration}m
                                </span>
                              </div>
                              <span className="text-earth-muted text-xs">
                                {formatPrice(Number(appt.price), settings)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-[16px] text-earth-muted flex-shrink-0">
                          face
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: appt.manicurist.color ?? "#8D6E63" }}
                          />
                          <span className="text-earth text-xs">{appt.manicurist.user.name}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-[16px] text-earth-muted flex-shrink-0">
                          schedule
                        </span>
                        <span className="text-earth text-xs">
                          {formatTime(new Date(appt.startAt))} — {formatTime(new Date(appt.endAt))}
                        </span>
                        <span className="text-earth-muted text-[10px]">({duration} min)</span>
                      </div>

                      {appt.notes && (
                        <div className="flex items-start gap-2.5">
                          <span className="material-symbols-outlined text-[16px] text-earth-muted flex-shrink-0 mt-0.5">
                            notes
                          </span>
                          <p className="text-earth-muted text-xs leading-relaxed">{appt.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
