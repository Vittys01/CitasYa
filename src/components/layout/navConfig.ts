import type { Role } from "@prisma/client";

export const navKeys = [
  { href: "/dashboard",    key: "Dashboard",    icon: "dashboard",      adminOnly: false, hideForManicurist: false, labelEs: "Panel" },
  { href: "/appointments", key: "Appointments", icon: "calendar_month", adminOnly: false, hideForManicurist: false, labelEs: "Turnos" },
  { href: "/clients",      key: "Clients",      icon: "group",          adminOnly: false, hideForManicurist: true,  labelEs: "Clientes" },
  { href: "/servicios",    key: "Servicios",    icon: "spa",            adminOnly: true,  hideForManicurist: true,  labelEs: "Servicios" },
  { href: "/equipo",       key: "Equipo",       icon: "badge",          adminOnly: true,  hideForManicurist: true,  labelEs: "Equipo" },
  { href: "/whatsapp",     key: "WhatsApp",     icon: "smartphone",     adminOnly: true,  hideForManicurist: true,  labelEs: "WhatsApp" },
  { href: "/settings",     key: "Settings",     icon: "settings",       adminOnly: true,  hideForManicurist: true,  labelEs: "Configuración" },
] as const;

export function getNavItems(role: Role) {
  return navKeys.filter((item) => {
    if (item.adminOnly && role !== "ADMIN") return false;
    if (item.hideForManicurist && role === "MANICURIST") return false;
    return true;
  });
}
