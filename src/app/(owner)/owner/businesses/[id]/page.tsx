import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import DeleteBusinessButton from "@/components/owner/DeleteBusinessButton";
import { CURRENCIES } from "@/lib/format-price";
import { getAppSettings } from "@/services/settings.service";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANICURIST: "Manicurista",
  RECEPTIONIST: "Recepcionista",
};

function formatCurrency(amount: number, currencyCode: string) {
  const cfg = CURRENCIES[currencyCode] ?? CURRENCIES["ARS"];
  return new Intl.NumberFormat(cfg.locale, {
    style: "currency",
    currency: cfg.currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export default async function BusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const ownerId = session!.user.id;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [business, totalRev, monthRev, settings] = await Promise.all([
    prisma.business.findFirst({
      where: { id, ownerId },
      include: {
        members: {
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
            manicurist: { select: { id: true, color: true } },
          },
        },
        _count: {
          select: {
            appointments: true,
            clients: true,
            services: true,
          },
        },
      },
    }),
    prisma.appointment.aggregate({
      where: { businessId: id, status: "COMPLETED" },
      _sum: { price: true },
    }),
    prisma.appointment.aggregate({
      where: {
        businessId: id,
        status: "COMPLETED",
        startAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { price: true },
    }),
    getAppSettings(id),
  ]);

  if (!business) notFound();

  const totalRevenue = Number(totalRev._sum.price ?? 0);
  const monthRevenue = Number(monthRev._sum.price ?? 0);
  const currentMonthLabel = now.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const currencyCode = settings["app.currency"] ?? "ARS";
  const currencyCfg = CURRENCIES[currencyCode] ?? CURRENCIES["ARS"];

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[#9c8273] mb-6">
        <Link href="/owner" className="hover:text-[#4a3b32] transition-colors">
          Empresas
        </Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-[#4a3b32] font-medium truncate">{business.name}</span>
      </nav>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-[#e6d5c3] shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary-dark text-[28px]">corporate_fare</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-[#4a3b32]">{business.name}</h1>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                    business.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {business.isActive ? "Activa" : "Inactiva"}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <p className="text-sm text-[#9c8273] font-mono">/{business.slug}</p>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#7a5c44] bg-[#ede0d4] rounded px-1.5 py-0.5">
                  <span className="material-symbols-outlined text-[10px]">payments</span>
                  {currencyCfg.currency}
                </span>
              </div>
              <p className="text-xs text-[#bda696] mt-1">
                Creada el{" "}
                {new Date(business.createdAt).toLocaleDateString("es-AR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/owner/businesses/${id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-[#7a5c44] hover:bg-[#efe6dd] transition-colors font-medium border border-[#e6d5c3]"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              Editar
            </Link>
            <DeleteBusinessButton id={business.id} name={business.name} />
          </div>
        </div>

        {/* Revenue row */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-[#faf0e8] to-[#fdf7f2] rounded-xl p-4 border border-[#ede0d4]">
            <p className="text-[10px] text-[#9c8273] font-semibold uppercase tracking-wide">
              Ingresos — {currentMonthLabel}
            </p>
            <p className="text-2xl font-black text-[#4a3b32] mt-1">{formatCurrency(monthRevenue, currencyCode)}</p>
          </div>
          <div className="bg-[#faf7f4] rounded-xl p-4 border border-[#ede0d4]">
            <div className="flex items-start justify-between">
              <p className="text-[10px] text-[#9c8273] font-semibold uppercase tracking-wide">
                Total histórico
              </p>
              <span className="text-[10px] text-[#bda696] bg-[#ede0d4] rounded px-1.5 py-0.5 font-mono font-semibold">
                {currencyCfg.currency}
              </span>
            </div>
            <p className="text-2xl font-black text-[#4a3b32] mt-1">{formatCurrency(totalRevenue, currencyCode)}</p>
          </div>
        </div>

        {/* Operational stats */}
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="bg-[#faf7f4] rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-[#4a3b32]">{business.members.length}</p>
            <p className="text-xs text-[#9c8273] font-medium mt-0.5">Empleados</p>
          </div>
          <div className="bg-[#faf7f4] rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-[#4a3b32]">{business._count.clients}</p>
            <p className="text-xs text-[#9c8273] font-medium mt-0.5">Clientes</p>
          </div>
          <div className="bg-[#faf7f4] rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-[#4a3b32]">{business._count.appointments}</p>
            <p className="text-xs text-[#9c8273] font-medium mt-0.5">Turnos</p>
          </div>
        </div>

        {/* WhatsApp info */}
        {business.whatsappProvider && (
          <div className="mt-4 flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-xl">
            <span className="material-symbols-outlined text-green-600 text-[20px]">smartphone</span>
            <div>
              <p className="text-xs font-semibold text-green-700">WhatsApp configurado</p>
              <p className="text-xs text-green-600">
                {business.whatsappProvider === "evolution"
                  ? `Evolution API · instancia: ${business.whatsappInstanceName ?? "—"}`
                  : `Meta Cloud API · ID: ${business.metaPhoneNumberId ?? "—"}`}
              </p>
            </div>
            <Link
              href={`/owner/businesses/${id}/edit`}
              className="ml-auto text-xs text-green-700 hover:text-green-900 underline underline-offset-2"
            >
              Cambiar
            </Link>
          </div>
        )}
        {!business.whatsappProvider && (
          <div className="mt-4 flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <span className="material-symbols-outlined text-amber-500 text-[20px]">smartphone</span>
            <p className="text-xs text-amber-700">WhatsApp no configurado para esta empresa.</p>
            <Link
              href={`/owner/businesses/${id}/edit`}
              className="ml-auto text-xs text-amber-700 hover:text-amber-900 underline underline-offset-2"
            >
              Configurar
            </Link>
          </div>
        )}
      </div>

      {/* Members table */}
      <div className="bg-white rounded-2xl border border-[#e6d5c3] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#f0e7de] flex items-center justify-between gap-3">
          <h2 className="font-bold text-[#4a3b32]">
            Trabajadores
            <span className="ml-2 text-sm font-normal text-[#9c8273]">
              ({business.members.length})
            </span>
          </h2>
          <Link
            href={`/owner/businesses/${id}/members/new`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary-dark transition-colors shadow-sm shrink-0"
          >
            <span className="material-symbols-outlined text-[14px]">person_add</span>
            Agregar miembro
          </Link>
        </div>

        {business.members.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-[#9c8273] text-sm">No hay trabajadores registrados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#faf7f4]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#9c8273] uppercase tracking-wide">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#9c8273] uppercase tracking-wide">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#9c8273] uppercase tracking-wide">
                    Rol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#9c8273] uppercase tracking-wide">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#9c8273] uppercase tracking-wide">
                    Desde
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0e7de]">
                {business.members.map((member) => (
                  <tr key={member.id} className="hover:bg-[#fdfaf8] transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: member.manicurist?.color
                              ? `${member.manicurist.color}30`
                              : "#efe6dd",
                          }}
                        >
                          <span className="material-symbols-outlined text-[14px] text-[#9c8273]">
                            person
                          </span>
                        </div>
                        <span className="font-medium text-[#4a3b32]">{member.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-[#9c8273]">{member.email}</td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#efe6dd] text-[#7a5c44]">
                        {ROLE_LABEL[member.role] ?? member.role}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          member.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {member.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-[#9c8273] text-xs">
                      {new Date(member.createdAt).toLocaleDateString("es-AR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
