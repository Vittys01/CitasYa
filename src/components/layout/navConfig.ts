import type { Role } from "@prisma/client";

/** Roles que pueden acceder a gestión (servicios, equipo, WhatsApp, settings). Manicuristas excluidos. */
export const STAFF_ROLES = ["ADMIN", "OWNER", "RECEPTIONIST"] as const;

export const navKeys = [
  { href: "/dashboard",    key: "Dashboard",    icon: "dashboard",       staffOnly: false, ownerOnly: false, labelEs: "Panel" },
  { href: "/appointments", key: "Appointments", icon: "calendar_month",  staffOnly: false, ownerOnly: false, labelEs: "Turnos" },
  { href: "/clients",      key: "Clients",      icon: "group",           staffOnly: true,  ownerOnly: false, labelEs: "Clientes" },
  { href: "/servicios",    key: "Servicios",    icon: "spa",             staffOnly: true,  ownerOnly: false, labelEs: "Servicios" },
  { href: "/equipo",       key: "Equipo",       icon: "badge",           staffOnly: true,  ownerOnly: false, labelEs: "Equipo" },
  { href: "/whatsapp",     key: "WhatsApp",     icon: "smartphone",      staffOnly: true,  ownerOnly: false, labelEs: "WhatsApp" },
  { href: "/settings",     key: "Settings",     icon: "settings",        staffOnly: true,  ownerOnly: false, labelEs: "Configuración" },
  { href: "/owner",        key: "nav.owner",    icon: "corporate_fare",  staffOnly: false, ownerOnly: true,  labelEs: "Empresas" },
] as const;

export function getNavItems(role: Role) {
  return navKeys.filter((item) => {
    if (item.ownerOnly && role !== "OWNER") return false;
    if (item.staffOnly && !STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number])) return false;
    return true;
  });
}
