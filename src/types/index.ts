import type {
  User,
  Manicurist,
  Schedule,
  Service,
  Client,
  Appointment,
  Notification,
  Role,
  AppointmentStatus,
  NotificationType,
  NotificationStatus,
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  PaymentMethod,
} from "@prisma/client";

// ─── Re-exports ───────────────────────────────────────────────────────────────
export type {
  User,
  Manicurist,
  Schedule,
  Service,
  Client,
  Appointment,
  Notification,
  Role,
  AppointmentStatus,
  NotificationType,
  NotificationStatus,
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  PaymentMethod,
};

// ─── Composed types ───────────────────────────────────────────────────────────

export type ManicuristWithUser = Manicurist & {
  user: Pick<User, "id" | "name" | "email" | "avatarUrl">;
  schedules: Schedule[];
};

export type AppointmentServiceWithService = {
  id: string;
  serviceId: string;
  manicuristId: string | null;
  durationMinutes: number | null;
  price: { toNumber: () => number } | number;
  sortOrder: number;
  service: Pick<Service, "id" | "name" | "duration" | "color">;
  manicurist?: { id: string; user: { name: string } } | null;
};

export type AppointmentWithRelations = Appointment & {
  client: Pick<Client, "id" | "name" | "phone" | "email">;
  manicurist: Manicurist & {
    user: Pick<User, "id" | "name" | "avatarUrl">;
  };
  service: Pick<Service, "id" | "name" | "duration" | "color">;
  services?: AppointmentServiceWithService[];
};

export type ClientWithHistory = Client & {
  appointments: AppointmentWithRelations[];
};

// ─── API request / response shapes ───────────────────────────────────────────

export interface AppointmentServiceInput {
  serviceId: string;
  durationMinutes?: number; // null/undefined = usar duración del servicio
  /** Precio de esta línea en la cita (si no se envía, usa el precio del catálogo). */
  price?: number;
  /** Profesional que realiza este servicio. Si no se envía, hereda el de la cita. */
  manicuristId?: string;
  /** Inicio propio de esta línea (ISO). Si se omite, continúa justo tras la línea anterior. */
  startAt?: string;
}

export interface CreateAppointmentInput {
  clientId: string;
  /** Opcional: si no se envía, se deriva del primer servicio con manicuristId. */
  manicuristId?: string;
  /** @deprecated Usar services. Si se pasa, se crea un solo servicio. */
  serviceId?: string;
  /** Múltiples servicios con duración personalizable */
  services?: AppointmentServiceInput[];
  startAt: string; // ISO string
  notes?: string;
  /** Precio total override (solo para esta cita, ej: diseño extra, adicionales) */
  price?: number;
  /** Duración del bloque en el calendario (min). Si no se envía, suma de las líneas. */
  totalDurationMinutes?: number;
  /** Si es false, no se envía confirmación por WhatsApp ni se programa recordatorio. Por defecto true. */
  sendWhatsApp?: boolean;
}

export interface UpdateAppointmentInput {
  status?: AppointmentStatus;
  notes?: string;
  startAt?: string;
  manicuristId?: string;
  serviceId?: string;
  /** Cambiar cliente del turno */
  clientId?: string;
  /** Reemplazar líneas de servicio (misma semántica que al crear) */
  services?: AppointmentServiceInput[];
  /** Precio total override (solo para esta cita) */
  price?: number;
  /** Duración del bloque en el calendario (min). Si no se envía, suma de las líneas. */
  totalDurationMinutes?: number;
  /** Si es false, al guardar se cancela el recordatorio y no se reprograma (ni confirmación en creación). Por defecto true. */
  sendWhatsApp?: boolean;
  /** Metodo de pago (al completar la cita). Efectivo = sin factura; Bizum/Datáfono = factura emitida. */
  paymentMethod?: PaymentMethod;
}

export interface CreateClientInput {
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  nif?: string;
}

export interface UpdateClientInput extends Partial<CreateClientInput> {}

export interface CreateServiceInput {
  name: string;
  description?: string;
  duration: number;
  price: number;
  color?: string;
}

export interface UpdateServiceInput extends Partial<CreateServiceInput> {
  isActive?: boolean;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export interface AvailabilitySlot {
  start: string; // ISO
  end: string;   // ISO
  available: boolean;
}

// ─── Dashboard types ──────────────────────────────────────────────────────────

export interface DashboardStats {
  todayAppointments: number;
  pendingToday: number;
  completedToday: number;
  revenueToday: number;
  revenueRange: number;
  appointmentsRange: number;
}

export interface ManicuristProductivity {
  manicuristId: string;
  name: string;
  color: string;
  totalAppointments: number;
  completedAppointments: number;
  totalRevenue: number;
  avgPerAppointment: number;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: PaginationMeta;
}

// ─── Invoice types ───────────────────────────────────────────────────────────

export type InvoiceWithRelations = Invoice & {
  items: InvoiceItem[];
  client: Pick<Client, "id" | "name" | "phone" | "email" | "nif">;
  appointment?: Pick<Appointment, "id" | "startAt" | "endAt"> | null;
  manicurist?: { id: string; user: { name: string } } | null;
};

export type InvoiceForClient = Omit<InvoiceWithRelations,
  "baseImponible" | "ivaRate" | "ivaAmount" | "irpfRate" | "irpfAmount" | "total" | "manicurist"
> & {
  baseImponible: number;
  ivaRate: number;
  ivaAmount: number;
  irpfRate: number;
  irpfAmount: number;
  total: number;
  manicurist?: { id: string; name: string } | null;
  items: Array<Omit<InvoiceItem, "unitPrice" | "totalPrice"> & {
    unitPrice: number;
    totalPrice: number;
  }>;
};

export interface InvoiceFilters {
  dateFrom?: string;
  dateTo?: string;
  clientId?: string;
  status?: InvoiceStatus;
  q?: string;
  manicuristId?: string;
  paymentMethod?: PaymentMethod;
  page?: number;
  limit?: number;
}
