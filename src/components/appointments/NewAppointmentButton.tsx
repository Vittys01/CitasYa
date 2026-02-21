"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format-price";
import type { Manicurist, Client, Schedule } from "@prisma/client";
import type { ServiceForClient } from "@/lib/serialize";
import type { EmptySlotPayload } from "./AppointmentsCalendar";

type SlotOption = { start: string; end: string; manicuristId: string; manicuristName: string };

type ManicuristWithDetails = Manicurist & {
  user: { id: string; name: string };
  schedules: Schedule[];
};

interface Props {
  manicurists:       ManicuristWithDetails[];
  services:          ServiceForClient[];
  clients:           Client[];
  settings?:         Record<string, string>;
  lockedManicuristId?: string;
  /** Controlled: open state (parent controls drawer) */
  open?: boolean;
  onClose?: () => void;
  /** Prefill when opening from calendar slot click */
  initialPrefill?: EmptySlotPayload | null;
  /** When false, no trigger button (parent renders it) */
  renderTrigger?: boolean;
}

const g = (s: Record<string, string> | undefined, k: string, fb: string) => (s && s[k]) ?? fb;

const schema = z.object({
  clientId:     z.string().min(1),
  manicuristId: z.string().min(1),
  serviceId:    z.string().min(1),
  startAt:      z.string().min(1),
  notes:        z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const labelCls = "block text-xs font-semibold text-earth uppercase tracking-wider mb-1.5";
const inputCls =
  "w-full px-3.5 py-2.5 text-sm border border-[#D7CCC8] rounded-lg bg-[#FFFDF5] text-earth placeholder-[#BCAAA4] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition";

export default function NewAppointmentButton({
  manicurists,
  services,
  clients,
  settings,
  lockedManicuristId,
  open: controlledOpen,
  onClose: controlledOnClose,
  initialPrefill,
  renderTrigger = true,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const isControlled = controlledOpen !== undefined && controlledOnClose !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (v: boolean) => { if (!v) controlledOnClose?.(); } : setInternalOpen;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const watchService = watch("serviceId");
  const selectedService = services.find((s) => s.id === watchService);

  // ── Slot state ──────────────────────────────────────────────────────────────
  const [manicuristFilter, setManicuristFilter] = useState<string>(lockedManicuristId ?? "");
  const [slotOptions, setSlotOptions]   = useState<SlotOption[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  /** Si está definido, se buscan turnos de este día; si no, se usan "próximos" */
  const [pickerDate, setPickerDate] = useState<string>("");

  const loadSlotsNext = useCallback(
    async (serviceId: string, manicuristId: string, signal: AbortSignal) => {
      if (!serviceId) { setSlotOptions([]); return; }
      setLoadingSlots(true);
      try {
        const params = new URLSearchParams({ serviceId, limit: "3" });
        if (manicuristId) params.set("manicuristId", manicuristId);
        const res  = await fetch(`/api/appointments/availability/next?${params}`, { signal });
        const data = await res.json();
        if (signal.aborted) return;
        const slots: SlotOption[] = data?.data ?? [];
        setSlotOptions(slots);
        if (slots.length > 0) {
          setValue("startAt",      slots[0].start,        { shouldValidate: false });
          setValue("manicuristId", slots[0].manicuristId, { shouldValidate: false });
        } else {
          setValue("startAt",      "", { shouldValidate: false });
          setValue("manicuristId", "", { shouldValidate: false });
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
        setSlotOptions([]);
      } finally {
        if (!signal.aborted) setLoadingSlots(false);
      }
    },
    [setValue]
  );

  const loadSlotsForDate = useCallback(
    async (serviceId: string, dateStr: string, manicuristId: string, signal: AbortSignal) => {
      if (!serviceId || !dateStr) { setSlotOptions([]); return; }
      setLoadingSlots(true);
      try {
        const manicuristIds = manicuristId
          ? [manicuristId]
          : manicurists.map((m) => m.id);
        const allSlots: SlotOption[] = [];
        for (const mid of manicuristIds) {
          if (signal.aborted) break;
          const params = new URLSearchParams({
            serviceId,
            date: dateStr,
            manicuristId: mid,
          });
          const res = await fetch(`/api/appointments/availability?${params}`, { signal });
          const data = await res.json();
          if (signal.aborted) return;
          const list = (data?.data ?? []) as { start: string; end: string }[];
          const man = manicurists.find((m) => m.id === mid);
          const name = man?.user.name ?? "";
          list.forEach((s) => allSlots.push({ ...s, manicuristId: mid, manicuristName: name }));
        }
        allSlots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        if (signal.aborted) return;
        setSlotOptions(allSlots);
        if (allSlots.length > 0) {
          setValue("startAt",      allSlots[0].start,        { shouldValidate: false });
          setValue("manicuristId", allSlots[0].manicuristId, { shouldValidate: false });
        } else {
          setValue("startAt",      "", { shouldValidate: false });
          setValue("manicuristId", "", { shouldValidate: false });
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
        setSlotOptions([]);
      } finally {
        if (!signal.aborted) setLoadingSlots(false);
      }
    },
    [manicurists, setValue]
  );

  useEffect(() => {
    const controller = new AbortController();
    const serviceId = watchService ?? "";
    if (pickerDate) {
      loadSlotsForDate(serviceId, pickerDate, manicuristFilter, controller.signal);
    } else {
      loadSlotsNext(serviceId, manicuristFilter, controller.signal);
    }
    return () => controller.abort();
  }, [watchService, manicuristFilter, pickerDate, loadSlotsNext, loadSlotsForDate]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function formatSlot(s: SlotOption) {
    const d = new Date(s.start);
    const dateStr = d.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "2-digit" });
    const timeStr = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    return `${dateStr} ${timeStr} — ${s.manicuristName}`;
  }

  function handleSlotChange(start: string) {
    setValue("startAt", start, { shouldValidate: false });
    const slot = slotOptions.find((s) => s.start === start);
    if (slot) setValue("manicuristId", slot.manicuristId, { shouldValidate: false });
  }

  function openDrawer() {
    reset();
    setManicuristFilter(lockedManicuristId ?? "");
    setPickerDate("");
    setSlotOptions([]);
    setError(null);
    if (!isControlled) setInternalOpen(true);
  }

  function closeDrawer() {
    if (isControlled) controlledOnClose?.(); else setInternalOpen(false);
  }

  // When controlled open becomes true with initialPrefill, apply prefill
  useEffect(() => {
    if (!open || !initialPrefill) return;
    setPickerDate(initialPrefill.date);
    setManicuristFilter(initialPrefill.manicuristId ?? lockedManicuristId ?? "");
    setValue("startAt", initialPrefill.startAt, { shouldValidate: false });
    if (initialPrefill.manicuristId) setValue("manicuristId", initialPrefill.manicuristId, { shouldValidate: false });
  }, [open, initialPrefill, lockedManicuristId, setValue]);

  // When slotOptions load and we have initialPrefill.startAt, try to select matching slot
  useEffect(() => {
    if (!initialPrefill?.startAt || slotOptions.length === 0) return;
    const match = slotOptions.find((s) => s.start === initialPrefill!.startAt);
    if (match) {
      setValue("startAt", match.start, { shouldValidate: false });
      setValue("manicuristId", match.manicuristId, { shouldValidate: false });
    }
  }, [slotOptions, initialPrefill?.startAt, setValue]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function onSubmit(data: FormData) {
    setError(null);
    if (!data.startAt || !data.manicuristId || !data.clientId || !data.serviceId) {
      setError(g(settings, "validation.fillAll", "Completá cliente, servicio y horario."));
      return;
    }
    try {
      const body = {
        clientId: data.clientId,
        manicuristId: data.manicuristId,
        serviceId: data.serviceId,
        startAt: new Date(data.startAt).toISOString(),
        notes: data.notes,
      };
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          (typeof json.error === "object" && json.error?.message) ||
          (typeof json.error === "string" && json.error) ||
          json.message ||
          g(settings, "error.createAppointment", "Error al crear el turno");
        setError(msg);
        return;
      }
      reset();
      if (isControlled) controlledOnClose?.();
      else setInternalOpen(false);
      // Cerrar primero para que al refrescar el calendario sea visible y se actualice
      await new Promise((r) => setTimeout(r, 0));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : g(settings, "error.createAppointment", "Error al crear el turno"));
    }
  }

  return (
    <>
      {/* Trigger: solo cuando no es controlado o el padre pide mostrarlo */}
      {renderTrigger && !isControlled && (
        <button
          onClick={openDrawer}
          className="flex items-center gap-2 bg-primary-dark hover:bg-primary-hover text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-warm-sm transition-all active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          {g(settings, "action.newAppointment", "Nuevo turno")}
        </button>
      )}

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-stone-900/25 backdrop-blur-sm" onClick={closeDrawer} />

          <div className="absolute inset-y-0 right-0 w-full max-w-md flex flex-col bg-[#FFFDF5] shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-[#e6d5c3] bg-[#FFFDF5] sticky top-0 z-10">
              <div>
                <h2 className="text-lg font-bold text-earth">{g(settings, "form.title.newAppointment", "Nuevo turno")}</h2>
                <p className="text-xs text-earth-muted mt-0.5">{g(settings, "form.subtitle.newAppointment", "Completá los datos del turno")}</p>
              </div>
              <button onClick={closeDrawer} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-cream-dark text-[#bda696] hover:text-earth transition">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 no-scrollbar">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2">
                  <span className="material-symbols-outlined text-red-600 shrink-0">error</span>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Client */}
              <div>
                <h3 className="text-[10px] font-bold text-primary-dark uppercase tracking-widest flex items-center gap-1.5 mb-4">
                  <span className="material-symbols-outlined text-[14px]">person</span>
                  {g(settings, "form.section.clientData", "Datos del cliente")}
                </h3>
                <div>
                  <label className={labelCls}>{g(settings, "form.clientLabel", "Cliente")}</label>
                  <select {...register("clientId")} className={inputCls}>
                    <option value="">{g(settings, "form.selectClient", "Seleccionar cliente...")}</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
                    ))}
                  </select>
                  {errors.clientId && <p className="text-red-500 text-xs mt-1">{g(settings, "validation.selectClient", "Seleccioná un cliente")}</p>}
                </div>
              </div>

              {/* Service */}
              <div className="border-t border-[#f0ede8] pt-5">
                <h3 className="text-[10px] font-bold text-primary-dark uppercase tracking-widest flex items-center gap-1.5 mb-4">
                  <span className="material-symbols-outlined text-[14px]">spa</span>
                  {g(settings, "form.section.service", "Servicio")}
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>{g(settings, "form.serviceType", "Tipo de servicio")}</label>
                    <select {...register("serviceId")} className={inputCls}>
                      <option value="">{g(settings, "form.selectService", "Seleccionar servicio...")}</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.duration} {g(settings, "common.minutes", "min")})</option>
                      ))}
                    </select>
                    {errors.serviceId && <p className="text-red-500 text-xs mt-1">{g(settings, "validation.selectService", "Seleccioná un servicio")}</p>}
                  </div>

                  {selectedService && (
                    <div className="bg-primary/5 rounded-xl border border-primary/20 p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-white shadow-warm-sm flex items-center justify-center">
                          <span className="material-symbols-outlined text-primary-dark text-[18px]">schedule</span>
                        </div>
                        <div>
                          <p className="text-[10px] text-earth-muted font-medium">{g(settings, "form.field.duration", "Duración")}</p>
                          <p className="text-sm font-bold text-earth">{selectedService.duration} {g(settings, "common.minutes", "min")}</p>
                        </div>
                      </div>
                      <div className="w-px h-8 bg-[#e6d5c3]" />
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-white shadow-warm-sm flex items-center justify-center">
                          <span className="material-symbols-outlined text-emerald-600 text-[18px]">payments</span>
                        </div>
                        <div>
                          <p className="text-[10px] text-earth-muted font-medium">{g(settings, "form.field.total", "Total")}</p>
                          <p className="text-sm font-bold text-earth">{formatPrice(Number(selectedService.price), settings)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Schedule */}
              <div className="border-t border-[#f0ede8] pt-5">
                <h3 className="text-[10px] font-bold text-primary-dark uppercase tracking-widest flex items-center gap-1.5 mb-4">
                  <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                  {g(settings, "form.section.schedule", "Horario")}
                </h3>
                <div className="space-y-3">
                  {/* Fecha opcional: si se elige, se muestran turnos de ese día */}
                  <div>
                    <label className={labelCls}>{g(settings, "form.field.date", "Ver turnos de un día (opcional)")}</label>
                    <input
                      type="date"
                      value={pickerDate}
                      onChange={(e) => setPickerDate(e.target.value)}
                      min={new Date().toISOString().slice(0, 10)}
                      className={inputCls}
                    />
                    <p className="text-[10px] text-earth-muted mt-1">
                      {pickerDate
                        ? g(settings, "form.field.dateHelp", "Mostrando horarios del día elegido")
                        : g(settings, "form.field.dateHelpNext", "Dejá vacío para ver los próximos disponibles")}
                    </p>
                  </div>
                  {/* Manicurist selector — hidden for manicurist role (lockedManicuristId pre-fills it) */}
                  {!lockedManicuristId ? (
                    <div>
                      <label className={labelCls}>{g(settings, "form.field.manicurist", "Profesional")}</label>
                      <select
                        value={manicuristFilter}
                        onChange={(e) => setManicuristFilter(e.target.value)}
                        className={inputCls}
                      >
                        <option value="">{g(settings, "form.select.anyManicurist", "Cualquiera (próximos disponibles)")}</option>
                        {manicurists.map((m) => (
                          <option key={m.id} value={m.id}>{m.user.name}</option>
                        ))}
                      </select>
                      {errors.manicuristId && <p className="text-red-500 text-xs mt-1">{g(settings, "validation.selectManicurist", "Seleccioná una profesional")}</p>}
                    </div>
                  ) : (
                    /* Show the locked manicurist as read-only info */
                    <div>
                      <label className={labelCls}>{g(settings, "form.field.manicurist", "Profesional")}</label>
                      <div className={cn(inputCls, "bg-[#f5f0ea] text-earth-muted cursor-default flex items-center gap-2")}>
                        <span className="material-symbols-outlined text-[16px] text-primary-dark">person</span>
                        {manicurists.find((m) => m.id === lockedManicuristId)?.user.name ?? ""}
                      </div>
                    </div>
                  )}
                  {/* Hidden field to satisfy form validation */}
                  <input type="hidden" {...register("manicuristId")} />

                  {/* Slot selector */}
                  <div>
                    <label className={labelCls}>
                      {pickerDate
                        ? g(settings, "form.field.slotsForDay", "Horarios del día elegido")
                        : g(settings, "form.field.nextSlots", "Próximos turnos disponibles")}
                    </label>
                    <select
                      value={watch("startAt") ?? ""}
                      onChange={(e) => handleSlotChange(e.target.value)}
                      disabled={!watchService || loadingSlots}
                      className={cn(inputCls, (!watchService || loadingSlots) && "opacity-60 cursor-not-allowed")}
                    >
                      <option value="">
                        {!watchService
                          ? g(settings, "message.selectServiceFirst", "Elegí un servicio primero")
                          : loadingSlots
                            ? g(settings, "message.searchingSlots", "Buscando turnos...")
                            : slotOptions.length === 0
                              ? g(settings, "message.noAvailability", "Sin disponibilidad en los próximos 14 días")
                              : "— Seleccionar horario —"}
                      </option>
                      {slotOptions.map((s) => (
                        <option key={`${s.start}-${s.manicuristId}`} value={s.start}>{formatSlot(s)}</option>
                      ))}
                    </select>
                    {errors.startAt && <p className="text-red-500 text-xs mt-1">{g(settings, "validation.selectDateTime", "Seleccioná fecha y hora")}</p>}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="border-t border-[#f0ede8] pt-5">
                <label className={labelCls}>{g(settings, "form.field.internalNotes", "Notas internas")}</label>
                <textarea
                  {...register("notes")}
                  rows={3}
                  placeholder={g(settings, "form.placeholder.internalNotes", "Ej: cliente prefiere sesión en silencio")}
                  className={cn(inputCls, "resize-none")}
                />
              </div>

              {/* WhatsApp toggle */}
              <div className="border-t border-[#f0ede8] pt-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-earth">{g(settings, "form.whatsapp.label", "Enviar confirmación por WhatsApp")}</p>
                    <p className="text-xs text-earth-muted mt-0.5">{g(settings, "form.whatsapp.sub", "Mensaje automático con fecha y hora")}</p>
                  </div>
                  <div className="w-11 h-6 bg-primary-dark rounded-full relative cursor-pointer">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[#F5F2E8] border-t border-[#e6d5c3] flex items-center gap-3 sticky bottom-0">
              {error && (
                <p className="flex-1 text-xs text-red-600 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={closeDrawer}
                className="px-4 py-2.5 text-sm font-medium border border-[#D7CCC8] rounded-lg text-earth hover:bg-cream-dark bg-white transition"
              >
                {g(settings, "common.cancel", "Cancelar")}
              </button>
              <button
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting}
                className="flex-1 px-5 py-2.5 text-sm font-bold bg-primary-dark hover:bg-primary-hover text-white rounded-lg shadow-warm-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">check</span>
                {isSubmitting ? g(settings, "common.saving", "Guardando...") : g(settings, "action.saveAppointment", "Guardar turno")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
