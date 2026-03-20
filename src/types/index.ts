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
};

// ─── Composed types ───────────────────────────────────────────────────────────

export type ManicuristWithUser = Manicurist & {
  user: Pick<User, "id" | "name" | "email" | "avatarUrl">;
  schedules: Schedule[];
};

export type AppointmentServiceWithService = {
  id: string;
  serviceId: string;
  durationMinutes: number | null;
  price: { toNumber: () => number } | number;
  sortOrder: number;
  service: Pick<Service, "id" | "name" | "duration" | "color">;
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
}

export interface CreateAppointmentInput {
  clientId: string;
  manicuristId: string;
  /** @deprecated Usar services. Si se pasa, se crea un solo servicio. */
  serviceId?: string;
  /** Múltiples servicios con duración personalizable */
  services?: AppointmentServiceInput[];
  startAt: string; // ISO string
  notes?: string;
  /** Precio total override (solo para esta cita, ej: diseño extra, adicionales) */
  price?: number;
}

export interface UpdateAppointmentInput {
  status?: AppointmentStatus;
  notes?: string;
  startAt?: string;
  manicuristId?: string;
  serviceId?: string;
  /** Precio total override (solo para esta cita) */
  price?: number;
}

export interface CreateClientInput {
  name: string;
  phone: string;
  email?: string;
  notes?: string;
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
  confirmedToday: number;
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
