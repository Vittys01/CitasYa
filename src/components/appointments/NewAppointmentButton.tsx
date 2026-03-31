"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { ceilToNextSlotMinute, cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format-price";
import type { Manicurist, Client, Schedule } from "@prisma/client";
import { appointmentFromApiJson, type ServiceForClient, type AppointmentForClient } from "@/lib/serialize";
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
  /** Modo edición: PATCH en lugar de POST */
  editingAppointment?: AppointmentForClient | null;
  /** Tras crear/editar OK: actualiza el calendario al instante (además de router.refresh) */
  onAppointmentSaved?: (appointment: AppointmentForClient) => void;
}

type NewClientForm = {
  name: string;
  phone: string;
  email: string;
  notes: string;
};

const g = (s: Record<string, string> | undefined, k: string, fb: string) => (s && s[k]) ?? fb;

type SelectedService = { serviceId: string; durationMinutes?: number; durationDisplay?: string };

const schema = z.object({
  clientId:     z.string().min(1),
  manicuristId: z.string().min(1),
  startAt:      z.string().min(1),
  notes:        z.string().optional(),
}).refine((d) => d.clientId && d.manicuristId && d.startAt, { message: "Completá todos los campos" });

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
  editingAppointment = null,
  onAppointmentSaved,
}: Props) {
  const editingRef = useRef<AppointmentForClient | null>(null);
  useEffect(() => {
    editingRef.current = editingAppointment;
  }, [editingAppointment]);
  const [internalOpen, setInternalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // ── Local client list (starts from prop, grows with inline creates) ──────────
  const [clientsList, setClientsList] = useState<Client[]>(clients);
  // Sync if parent re-renders with updated clients (e.g. server refresh)
  useEffect(() => { setClientsList(clients); }, [clients]);

  // ── New-client inline form ────────────────────────────────────────────────────
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState<NewClientForm>({ name: "", phone: "", email: "", notes: "" });
  const [newClientLoading, setNewClientLoading] = useState(false);
  const [newClientError, setNewClientError] = useState("");

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

  // ── Selected services (múltiples + duración personalizable) ────────────────────
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const totalDuration = selectedServices.reduce((sum, item) => {
    const svc = services.find((s) => s.id === item.serviceId);
    const d = item.durationDisplay !== undefined
    ? parseInt(item.durationDisplay, 10)
    : item.durationMinutes;
  return sum + (Number.isNaN(d) || d === undefined ? (svc?.duration ?? 0) : d);
  }, 0);
  const totalPrice = selectedServices.reduce((sum, item) => {
    const svc = services.find((s) => s.id === item.serviceId);
    return sum + (svc ? Number(svc.price) : 0);
  }, 0);
  const firstServiceId = selectedServices[0]?.serviceId ?? "";

  const [priceOverride, setPriceOverride] = useState<number | null>(null);
  useEffect(() => { setPriceOverride(null); }, [selectedServices]);
  const finalPrice = priceOverride ?? totalPrice;

  // ── Slot state ──────────────────────────────────────────────────────────────
  const [manicuristFilter, setManicuristFilter] = useState<string>(lockedManicuristId ?? "");
  const [slotOptions, setSlotOptions]   = useState<SlotOption[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  /** Si está definido, se buscan turnos de este día; si no, se usan "próximos" */
  const [pickerDate, setPickerDate] = useState<string>("");

  const loadSlotsNext = useCallback(
    async (serviceId: string, duration: number, manicuristId: string, signal: AbortSignal) => {
      if (!serviceId || duration < 1) { setSlotOptions([]); return; }
      setLoadingSlots(true);
      try {
        const params = new URLSearchParams({ serviceId, duration: String(duration), limit: "3" });
        if (manicuristId) params.set("manicuristId", manicuristId);
        const res  = await fetch(`/api/appointments/availability/next?${params}`, { signal });
        const data = await res.json();
        if (signal.aborted) return;
        const slots: SlotOption[] = data?.data ?? [];
        setSlotOptions(slots);
        const edit = editingRef.current;
        if (slots.length > 0) {
          if (edit?.id) {
            const want = new Date(edit.startAt as string).getTime();
            const match = slots.find((s) => Math.abs(new Date(s.start).getTime() - want) < 120000);
            if (match) {
              setValue("startAt", match.start, { shouldValidate: false });
              setValue("manicuristId", match.manicuristId, { shouldValidate: false });
            } else {
              setValue("startAt", new Date(edit.startAt as string).toISOString(), { shouldValidate: false });
              setValue("manicuristId", edit.manicuristId, { shouldValidate: false });
            }
          } else {
            setValue("startAt", slots[0].start, { shouldValidate: false });
            setValue("manicuristId", slots[0].manicuristId, { shouldValidate: false });
          }
        } else {
          setValue("startAt", "", { shouldValidate: false });
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
    async (serviceId: string, duration: number, dateStr: string, manicuristId: string, signal: AbortSignal) => {
      if (!serviceId || duration < 1 || !dateStr) { setSlotOptions([]); return; }
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
            duration: String(duration),
            date: dateStr,
            manicuristId: mid,
          });
          const res = await fetch(`/api/appointments/availability?${params}`, { signal });
          const data = await res.json();
          if (signal.aborted) return;
          let list = (data?.data ?? []) as { start: string; end: string }[];
          if (dateStr === format(new Date(), "yyyy-MM-dd")) {
            const notBefore = ceilToNextSlotMinute(new Date());
            list = list.filter((s) => new Date(s.start) >= notBefore);
          }
          const man = manicurists.find((m) => m.id === mid);
          const name = man?.user.name ?? "";
          list.forEach((s) => allSlots.push({ ...s, manicuristId: mid, manicuristName: name }));
        }
        allSlots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        if (signal.aborted) return;
        setSlotOptions(allSlots);
        const edit = editingRef.current;
        if (allSlots.length > 0) {
          if (edit?.id) {
            const want = new Date(edit.startAt as string).getTime();
            const match = allSlots.find((s) => Math.abs(new Date(s.start).getTime() - want) < 120000);
            if (match) {
              setValue("startAt", match.start, { shouldValidate: false });
              setValue("manicuristId", match.manicuristId, { shouldValidate: false });
            } else {
              setValue("startAt", new Date(edit.startAt as string).toISOString(), { shouldValidate: false });
              setValue("manicuristId", edit.manicuristId, { shouldValidate: false });
            }
          } else {
            setValue("startAt", allSlots[0].start, { shouldValidate: false });
            setValue("manicuristId", allSlots[0].manicuristId, { shouldValidate: false });
          }
        } else {
          setValue("startAt", "", { shouldValidate: false });
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
    const serviceId = firstServiceId;
    const duration = totalDuration;
    if (pickerDate) {
      loadSlotsForDate(serviceId, duration, pickerDate, manicuristFilter, controller.signal);
    } else {
      loadSlotsNext(serviceId, duration, manicuristFilter, controller.signal);
    }
    return () => controller.abort();
  }, [firstServiceId, totalDuration, manicuristFilter, pickerDate, loadSlotsNext, loadSlotsForDate]);

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
    setSelectedServices([]);
    setPriceOverride(null);
    setManicuristFilter(lockedManicuristId ?? "");
    setPickerDate("");
    setSlotOptions([]);
    setError(null);
    setShowNewClient(false);
    setNewClient({ name: "", phone: "", email: "", notes: "" });
    setNewClientError("");
    if (!isControlled) setInternalOpen(true);
  }

  function closeDrawer() {
    if (isControlled) controlledOnClose?.(); else setInternalOpen(false);
  }

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault();
    setNewClientError("");
    setNewClientLoading(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClient.name.trim(),
          phone: newClient.phone.trim(),
          email: newClient.email.trim() || undefined,
          notes: newClient.notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNewClientError(json?.error?.message ?? "Error al crear el cliente");
        return;
      }
      const created: Client = json.data;
      setClientsList((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setValue("clientId", created.id, { shouldValidate: true });
      setShowNewClient(false);
      setNewClient({ name: "", phone: "", email: "", notes: "" });
    } catch {
      setNewClientError("Error de conexión");
    } finally {
      setNewClientLoading(false);
    }
  }

  // Modo edición: cargar turno existente
  useEffect(() => {
    if (!open || !editingAppointment) return;
    const a = editingAppointment;
    setSelectedServices(
      a.services?.length
        ? a.services.map((s) => ({
            serviceId: s.serviceId,
            durationMinutes: s.durationMinutes ?? undefined,
          }))
        : [{ serviceId: a.serviceId }]
    );
    setPriceOverride(Number(a.price));
    setValue("clientId", a.clientId, { shouldValidate: true });
    setValue("manicuristId", a.manicuristId, { shouldValidate: true });
    setValue("notes", a.notes ?? "", { shouldValidate: false });
    const d = new Date(a.startAt as string);
    setPickerDate(format(d, "yyyy-MM-dd"));
    setManicuristFilter(lockedManicuristId ?? a.manicuristId);
    const iso = typeof a.startAt === "string" ? a.startAt : new Date(a.startAt).toISOString();
    setValue("startAt", iso, { shouldValidate: false });
    setShowNewClient(false);
    setError(null);
  }, [open, editingAppointment?.id, setValue, lockedManicuristId]);

  // When controlled open becomes true with initialPrefill, apply prefill
  useEffect(() => {
    if (!open || !initialPrefill || editingAppointment) return;
    setPickerDate(initialPrefill.date);
    setManicuristFilter(initialPrefill.manicuristId ?? lockedManicuristId ?? "");
    setValue("startAt", initialPrefill.startAt, { shouldValidate: false });
    if (initialPrefill.manicuristId) setValue("manicuristId", initialPrefill.manicuristId, { shouldValidate: false });
  }, [open, initialPrefill, lockedManicuristId, setValue]);

  // When slotOptions load and we have initialPrefill.startAt, try to select matching slot
  useEffect(() => {
    if (editingAppointment || !initialPrefill?.startAt || slotOptions.length === 0) return;
    const match = slotOptions.find((s) => s.start === initialPrefill!.startAt);
    if (match) {
      setValue("startAt", match.start, { shouldValidate: false });
      setValue("manicuristId", match.manicuristId, { shouldValidate: false });
    }
  }, [slotOptions, initialPrefill?.startAt, setValue]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function onSubmit(data: FormData) {
    setError(null);
    if (!data.startAt || !data.manicuristId || !data.clientId || selectedServices.length === 0) {
      setError(g(settings, "validation.fillAll", "Completá cliente, al menos un servicio y horario."));
      return;
    }
    try {
      const servicesPayload = selectedServices.map((s) => ({
        serviceId: s.serviceId,
        ...(s.durationMinutes != null && { durationMinutes: s.durationMinutes }),
      }));
      const body = {
        clientId: data.clientId,
        manicuristId: data.manicuristId,
        services: servicesPayload,
        startAt: new Date(data.startAt).toISOString(),
        notes: data.notes,
        price: finalPrice,
      };

      const url = editingAppointment?.id
        ? `/api/appointments/${editingAppointment.id}`
        : "/api/appointments";
      const method = editingAppointment?.id ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          (typeof json.error === "object" && json.error?.message) ||
          (typeof json.error === "string" && json.error) ||
          json.message ||
          (editingAppointment
            ? "Error al guardar el turno"
            : g(settings, "error.createAppointment", "Error al crear el turno"));
        setError(msg);
        return;
      }
      const raw = (json as { data?: unknown }).data;
      const merged = raw ? appointmentFromApiJson(raw) : null;
      if (merged && onAppointmentSaved) onAppointmentSaved(merged);
      reset();
      if (isControlled) controlledOnClose?.();
      else setInternalOpen(false);
      await new Promise((r) => setTimeout(r, 0));
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editingAppointment
            ? "Error al guardar el turno"
            : g(settings, "error.createAppointment", "Error al crear el turno")
      );
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
                <h2 className="text-lg font-bold text-earth">
                  {editingAppointment
                    ? g(settings, "form.title.editAppointment", "Editar turno")
                    : g(settings, "form.title.newAppointment", "Nuevo turno")}
                </h2>
                <p className="text-xs text-earth-muted mt-0.5">
                  {editingAppointment
                    ? g(settings, "form.subtitle.editAppointment", "Modificá servicios, horario o cliente")
                    : g(settings, "form.subtitle.newAppointment", "Completá los datos del turno")}
                </p>
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

                {/* Existing client selector */}
                {!showNewClient && (
                  <div className="space-y-2">
                    <label className={labelCls}>{g(settings, "form.clientLabel", "Cliente")}</label>
                    <select {...register("clientId")} className={inputCls}>
                      <option value="">{g(settings, "form.selectClient", "Seleccionar cliente...")}</option>
                      {clientsList.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
                      ))}
                    </select>
                    {errors.clientId && (
                      <p className="text-red-500 text-xs mt-1">
                        {g(settings, "validation.selectClient", "Seleccioná un cliente")}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowNewClient(true)}
                      className="flex items-center gap-1.5 text-xs text-primary-dark hover:text-primary font-semibold mt-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">person_add</span>
                      Crear cliente nuevo
                    </button>
                  </div>
                )}

                {/* Inline new-client form */}
                {showNewClient && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold text-primary-dark flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">person_add</span>
                        Nuevo cliente
                      </p>
                      <button
                        type="button"
                        onClick={() => { setShowNewClient(false); setNewClientError(""); }}
                        className="text-[#bda696] hover:text-earth transition"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>

                    {newClientError && (
                      <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px] shrink-0">error</span>
                        {newClientError}
                      </p>
                    )}

                    <form onSubmit={handleCreateClient} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Nombre <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={newClient.name}
                            onChange={(e) => setNewClient((p) => ({ ...p, name: e.target.value }))}
                            placeholder="Nombre completo"
                            required
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Teléfono <span className="text-red-500">*</span></label>
                          <input
                            type="tel"
                            value={newClient.phone}
                            onChange={(e) => setNewClient((p) => ({ ...p, phone: e.target.value }))}
                            placeholder="549XXXXXXXXXX"
                            required
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Email <span className="text-xs text-earth-muted font-normal">(opcional)</span></label>
                        <input
                          type="email"
                          value={newClient.email}
                          onChange={(e) => setNewClient((p) => ({ ...p, email: e.target.value }))}
                          placeholder="cliente@email.com"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Notas <span className="text-xs text-earth-muted font-normal">(opcional)</span></label>
                        <input
                          type="text"
                          value={newClient.notes}
                          onChange={(e) => setNewClient((p) => ({ ...p, notes: e.target.value }))}
                          placeholder="Ej: alergia a ciertos productos"
                          className={inputCls}
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={newClientLoading}
                          className="flex-1 px-4 py-2 text-sm font-bold bg-primary-dark text-white rounded-lg hover:bg-primary-hover disabled:opacity-60 transition flex items-center justify-center gap-1.5"
                        >
                          {newClientLoading ? (
                            <>
                              <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                              Creando...
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-[14px]">check</span>
                              Crear y seleccionar
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowNewClient(false); setNewClientError(""); }}
                          className="px-3 py-2 text-sm text-earth border border-[#D7CCC8] rounded-lg hover:bg-cream-dark bg-white transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>

              {/* Services (múltiples + duración personalizable) */}
              <div className="border-t border-[#f0ede8] pt-5">
                <h3 className="text-[10px] font-bold text-primary-dark uppercase tracking-widest flex items-center gap-1.5 mb-4">
                  <span className="material-symbols-outlined text-[14px]">spa</span>
                  {g(settings, "form.section.service", "Servicio")}
                </h3>
                <div className="space-y-3">
                  {selectedServices.map((item, idx) => {
                    const svc = services.find((s) => s.id === item.serviceId);
                    const dur = item.durationMinutes ?? svc?.duration ?? 0;
                    const displayValue = item.durationDisplay !== undefined
                      ? item.durationDisplay
                      : String(dur);
                    return (
                      <div
                        key={`${item.serviceId}-${idx}`}
                        className="flex items-center gap-2 p-3 rounded-xl border border-primary/20 bg-primary/5"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-earth truncate">{svc?.name ?? "—"}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-earth-muted">{g(settings, "form.field.duration", "Duración")}:</span>
                            <input
                              type="number"
                              min={5}
                              max={480}
                              step={5}
                              value={displayValue}
                              onChange={(e) => {
                                const raw = e.target.value;
                                setSelectedServices((prev) =>
                                  prev.map((s, i) =>
                                    i === idx
                                      ? {
                                          ...s,
                                          durationDisplay: raw,
                                          durationMinutes: raw === "" ? undefined : (parseInt(raw, 10) || undefined),
                                        }
                                      : s
                                  )
                                );
                              }}
                              onBlur={(e) => {
                                const raw = e.target.value;
                                const v = parseInt(raw, 10);
                                if (raw === "" || Number.isNaN(v)) {
                                  setSelectedServices((prev) =>
                                    prev.map((s, i) =>
                                      i === idx ? { ...s, durationDisplay: undefined, durationMinutes: undefined } : s
                                    )
                                  );
                                } else {
                                  setSelectedServices((prev) =>
                                    prev.map((s, i) =>
                                      i === idx ? { ...s, durationDisplay: undefined, durationMinutes: v } : s
                                    )
                                  );
                                }
                              }}
                              className="w-16 px-2 py-1 text-xs border border-[#D7CCC8] rounded bg-white"
                            />
                            <span className="text-[10px] text-earth-muted">{g(settings, "common.minutes", "min")}</span>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-earth shrink-0">{formatPrice(svc ? Number(svc.price) : 0, settings)}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedServices((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1.5 rounded-lg hover:bg-red-100 text-earth-muted hover:text-red-600 transition"
                          title="Quitar"
                        >
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      </div>
                    );
                  })}
                  <select
                    value=""
                    onChange={(e) => {
                      const id = e.target.value;
                      if (id) {
                        setSelectedServices((prev) => [...prev, { serviceId: id }]);
                        e.target.value = "";
                      }
                    }}
                    className={inputCls}
                  >
                    <option value="">+ {g(settings, "form.addService", "Agregar servicio")}</option>
                    {services
                      .filter((s) => !selectedServices.some((x) => x.serviceId === s.id))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.duration} {g(settings, "common.minutes", "min")})
                        </option>
                      ))}
                  </select>
                  {selectedServices.length > 0 && (
                    <div className="bg-primary/5 rounded-xl border border-primary/20 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-white shadow-warm-sm flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary-dark text-[18px]">schedule</span>
                          </div>
                          <div>
                            <p className="text-[10px] text-earth-muted font-medium">{g(settings, "form.field.duration", "Duración total")}</p>
                            <p className="text-sm font-bold text-earth">{totalDuration} {g(settings, "common.minutes", "min")}</p>
                          </div>
                        </div>
                        <div className="w-px h-8 bg-[#e6d5c3]" />
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-white shadow-warm-sm flex items-center justify-center">
                            <span className="material-symbols-outlined text-emerald-600 text-[18px]">payments</span>
                          </div>
                          <div>
                            <p className="text-[10px] text-earth-muted font-medium">{g(settings, "form.field.total", "Total")}</p>
                            <p className="text-sm font-bold text-earth">{formatPrice(totalPrice, settings)}</p>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-earth-muted font-medium block mb-1">
                          {g(settings, "form.field.priceOverride", "Precio para esta cita")}
                          <span className="text-earth-muted/70 ml-1">({g(settings, "form.field.priceOverrideHelp", "diseño extra, adicionales")})</span>
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={finalPrice}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            setPriceOverride(Number.isNaN(v) ? null : v);
                          }}
                          className="w-full px-3 py-2 text-sm border border-[#D7CCC8] rounded-lg bg-white"
                          placeholder={String(totalPrice)}
                        />
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
                      disabled={selectedServices.length === 0 || loadingSlots}
                      className={cn(inputCls, (selectedServices.length === 0 || loadingSlots) && "opacity-60 cursor-not-allowed")}
                    >
                      <option value="">
                        {selectedServices.length === 0
                          ? g(settings, "message.selectServiceFirst", "Elegí al menos un servicio primero")
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
                {isSubmitting
                  ? g(settings, "common.saving", "Guardando...")
                  : editingAppointment
                    ? g(settings, "action.saveAppointmentEdit", "Guardar cambios")
                    : g(settings, "action.saveAppointment", "Guardar turno")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
