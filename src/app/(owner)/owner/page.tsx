import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import DeleteBusinessButton from "@/components/owner/DeleteBusinessButton";
import { CURRENCIES } from "@/lib/format-price";

export const dynamic = "force-dynamic";

function formatCurrency(amount: number, currencyCode: string) {
  const cfg = CURRENCIES[currencyCode] ?? CURRENCIES["ARS"];
  return new Intl.NumberFormat(cfg.locale, {
    style: "currency",
    currency: cfg.currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export default async function OwnerPage() {
  const session = await auth();
  const ownerId = session!.user.id;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const businesses = await prisma.business.findMany({
    where: { ownerId },
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          members: true,
          manicurists: true,
          appointments: true,
        },
      },
    },
  });

  const bizIds = businesses.map((b) => b.id);

  // Revenue + settings in parallel
  const [totalRevenue, monthRevenue, allSettings] = await Promise.all([
    prisma.appointment.groupBy({
      by: ["businessId"],
      where: { businessId: { in: bizIds }, status: "COMPLETED" },
      _sum: { price: true },
    }),
    prisma.appointment.groupBy({
      by: ["businessId"],
      where: {
        businessId: { in: bizIds },
        status: "COMPLETED",
        startAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { price: true },
    }),
    prisma.appSetting.findMany({
      where: { businessId: { in: bizIds }, key: "app.currency" },
      select: { businessId: true, value: true },
    }),
  ]);

  const totalMap = Object.fromEntries(
    totalRevenue.map((r) => [r.businessId, Number(r._sum.price ?? 0)])
  );
  const monthMap = Object.fromEntries(
    monthRevenue.map((r) => [r.businessId, Number(r._sum.price ?? 0)])
  );
  const currencyMap = Object.fromEntries(
    allSettings.map((s) => [s.businessId, s.value])
  );

  const currentMonthLabel = now.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#4a3b32]">Mis Empresas</h1>
          <p className="text-sm text-[#9c8273] mt-1">
            {businesses.length === 0
              ? "Aún no tienes empresas registradas."
              : `${businesses.length} empresa${businesses.length !== 1 ? "s" : ""} registrada${businesses.length !== 1 ? "s" : ""}.`}
          </p>
        </div>
        <Link
          href="/owner/businesses/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Nueva empresa
        </Link>
      </div>

      {businesses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#efe6dd] flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[#c4a882] text-[32px]">corporate_fare</span>
          </div>
          <p className="text-[#9c8273] font-medium mb-1">No hay empresas todavía</p>
          <p className="text-sm text-[#bda696]">Crea tu primera empresa para comenzar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {businesses.map((biz) => (
            <div
              key={biz.id}
              className="bg-white rounded-2xl border border-[#e6d5c3] shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-shadow"
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary-dark text-[20px]">corporate_fare</span>
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-[#4a3b32] text-base truncate">{biz.name}</h2>
                    <p className="text-xs text-[#9c8273] font-mono">/{biz.slug}</p>
                  </div>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                    biz.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {biz.isActive ? "Activa" : "Inactiva"}
                </span>
              </div>

              {/* Revenue highlight */}
              <div className="bg-gradient-to-r from-[#faf0e8] to-[#fdf7f2] rounded-xl p-3 border border-[#ede0d4]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-[#9c8273] font-medium uppercase tracking-wide">
                      Ingresos — {currentMonthLabel}
                    </p>
                    <p className="text-xl font-black text-[#4a3b32] mt-0.5">
                      {formatCurrency(monthMap[biz.id] ?? 0, currencyMap[biz.id] ?? "ARS")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-[#9c8273] font-medium uppercase tracking-wide">Total histórico</p>
                    <p className="text-sm font-bold text-[#7a5c44] mt-0.5">
                      {formatCurrency(totalMap[biz.id] ?? 0, currencyMap[biz.id] ?? "ARS")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#faf7f4] rounded-xl p-2">
                  <p className="text-lg font-bold text-[#4a3b32]">{biz._count.members}</p>
                  <p className="text-[10px] text-[#9c8273] font-medium">Empleados</p>
                </div>
                <div className="bg-[#faf7f4] rounded-xl p-2">
                  <p className="text-lg font-bold text-[#4a3b32]">{biz._count.manicurists}</p>
                  <p className="text-[10px] text-[#9c8273] font-medium">Manicuristas</p>
                </div>
                <div className="bg-[#faf7f4] rounded-xl p-2">
                  <p className="text-lg font-bold text-[#4a3b32]">{biz._count.appointments}</p>
                  <p className="text-[10px] text-[#9c8273] font-medium">Turnos</p>
                </div>
              </div>

              {/* WhatsApp badge */}
              {biz.whatsappProvider && (
                <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 rounded-lg px-2.5 py-1.5 w-fit">
                  <span className="material-symbols-outlined text-[14px]">smartphone</span>
                  WhatsApp: {biz.whatsappProvider === "evolution" ? biz.whatsappInstanceName ?? "Evolution" : "Meta"}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1 pt-2 border-t border-[#f0e7de] flex-wrap">
                <Link
                  href={`/owner/businesses/${biz.id}`}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg text-[#7a5c44] hover:bg-[#efe6dd] transition-colors font-medium"
                >
                  <span className="material-symbols-outlined text-[14px]">visibility</span>
                  Ver detalle
                </Link>
                <Link
                  href={`/owner/businesses/${biz.id}/edit`}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg text-[#7a5c44] hover:bg-[#efe6dd] transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">edit</span>
                  Editar
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg text-[#7a5c44] hover:bg-[#efe6dd] transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  Dashboard
                </Link>
                <div className="ml-auto">
                  <DeleteBusinessButton id={biz.id} name={biz.name} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
