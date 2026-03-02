import type { Role } from "@prisma/client";

export const navKeys = [
  { href: "/dashboard",    key: "Dashboard",    icon: "dashboard",       adminOnly: false, hideForManicurist: false, ownerOnly: false, labelEs: "Panel" },
  { href: "/appointments", key: "Appointments", icon: "calendar_month",  adminOnly: false, hideForManicurist: false, ownerOnly: false, labelEs: "Turnos" },
  { href: "/clients",      key: "Clients",      icon: "group",           adminOnly: false, hideForManicurist: true,  ownerOnly: false, labelEs: "Clientes" },
  { href: "/servicios",    key: "Servicios",    icon: "spa",             adminOnly: true,  hideForManicurist: true,  ownerOnly: false, labelEs: "Servicios" },
  { href: "/equipo",       key: "Equipo",       icon: "badge",           adminOnly: true,  hideForManicurist: true,  ownerOnly: false, labelEs: "Equipo" },
  { href: "/whatsapp",     key: "WhatsApp",     icon: "smartphone",      adminOnly: true,  hideForManicurist: true,  ownerOnly: false, labelEs: "WhatsApp" },
  { href: "/settings",     key: "Settings",     icon: "settings",        adminOnly: true,  hideForManicurist: true,  ownerOnly: false, labelEs: "Configuración" },
  { href: "/owner",        key: "nav.owner",    icon: "corporate_fare",  adminOnly: false, hideForManicurist: true,  ownerOnly: true,  labelEs: "Empresas" },
] as const;

export function getNavItems(role: Role) {
  return navKeys.filter((item) => {
    if (item.ownerOnly && role !== "OWNER") return false;
    if (item.adminOnly && role !== "ADMIN" && role !== "OWNER") return false;
    if (item.hideForManicurist && role === "MANICURIST") return false;
    return true;
  });
}
