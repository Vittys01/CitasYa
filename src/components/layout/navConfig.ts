import type { Role } from "@prisma/client";

/** Roles que pueden acceder a gestión (servicios, equipo, settings). Manicuristas excluidos. */
export const STAFF_ROLES = ["ADMIN", "OWNER", "RECEPTIONIST"] as const;
/** Roles que pueden acceder a facturas. */
export const INVOICE_ROLES = ["OWNER", "ADMIN"] as const;

export const navKeys = [
  { href: "/dashboard",    key: "Dashboard",    icon: "dashboard",       staffOnly: false, ownerOnly: false, adminOnly: false, labelEs: "Panel" },
  { href: "/appointments", key: "Appointments", icon: "calendar_month",  staffOnly: false, ownerOnly: false, adminOnly: false, labelEs: "Turnos" },
  { href: "/whatsapp",     key: "WhatsApp",     icon: "chat",            staffOnly: true,  ownerOnly: false, adminOnly: false, labelEs: "Chat WhatsApp" },
  { href: "/clients",      key: "Clients",      icon: "group",           staffOnly: true,  ownerOnly: false, adminOnly: false, labelEs: "Clientes" },
  { href: "/servicios",    key: "Servicios",    icon: "spa",             staffOnly: true,  ownerOnly: false, adminOnly: false, labelEs: "Servicios" },
  { href: "/equipo",       key: "Equipo",       icon: "badge",           staffOnly: true,  ownerOnly: false, adminOnly: false, labelEs: "Equipo" },
  { href: "/facturas",     key: "Facturas",     icon: "receipt_long",    staffOnly: false, ownerOnly: false, adminOnly: true,  labelEs: "Facturas" },
  { href: "/settings",     key: "Settings",     icon: "settings",        staffOnly: true,  ownerOnly: false, adminOnly: false, labelEs: "Configuración" },
  { href: "/owner",        key: "nav.owner",    icon: "corporate_fare",  staffOnly: false, ownerOnly: true,  adminOnly: false, labelEs: "Empresas" },
] as const;

export function getNavItems(role: Role) {
  return navKeys.filter((item) => {
    if (item.ownerOnly && role !== "OWNER") return false;
    if (item.staffOnly && !STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number])) return false;
    if (item.adminOnly && !INVOICE_ROLES.includes(role as (typeof INVOICE_ROLES)[number])) return false;
    return true;
  });
}
