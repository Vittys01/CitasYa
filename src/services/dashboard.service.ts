import { prisma } from "@/lib/db";
import type { DashboardStats, ManicuristProductivity } from "@/types";

export async function getDashboardStats(
  from: Date,
  to: Date,
  manicuristId?: string
): Promise<DashboardStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  const maniFilter = manicuristId ? { manicuristId } : {};

  const [
    todayAppointments,
    revenueToday,
    revenueRange,
    appointmentsRange,
  ] = await Promise.all([
    prisma.appointment.groupBy({
      by: ["status"],
      where: { startAt: { gte: today, lte: todayEnd }, ...maniFilter },
      _count: { _all: true },
    }),
    prisma.appointment.aggregate({
      where: { startAt: { gte: today, lte: todayEnd }, status: "COMPLETED", ...maniFilter },
      _sum: { price: true },
    }),
    prisma.appointment.aggregate({
      where: { startAt: { gte: from, lte: to }, status: "COMPLETED", ...maniFilter },
      _sum: { price: true },
    }),
    prisma.appointment.count({
      where: { startAt: { gte: from, lte: to }, ...maniFilter },
    }),
  ]);

  const statusMap = Object.fromEntries(
    todayAppointments.map((g) => [g.status, g._count._all])
  );

  return {
    todayAppointments: todayAppointments.reduce((s, g) => s + g._count._all, 0),
    confirmedToday: statusMap["CONFIRMED"] ?? 0,
    pendingToday: statusMap["PENDING"] ?? 0,
    completedToday: statusMap["COMPLETED"] ?? 0,
    revenueToday: Number(revenueToday._sum.price ?? 0),
    revenueRange: Number(revenueRange._sum.price ?? 0),
    appointmentsRange,
  };
}

export async function getManicuristProductivity(
  from: Date,
  to: Date,
  filterManicuristId?: string
): Promise<ManicuristProductivity[]> {
  const manicurists = await prisma.manicurist.findMany({
    where: {
      isActive: true,
      ...(filterManicuristId ? { id: filterManicuristId } : {}),
    },
    include: {
      user: { select: { id: true, name: true } },
      appointments: {
        where: { startAt: { gte: from, lte: to } },
        select: { status: true, price: true },
      },
    },
  });

  return manicurists.map((m) => {
    const total = m.appointments.length;
    const completed = m.appointments.filter((a) => a.status === "COMPLETED");
    const revenue = completed.reduce((s, a) => s + Number(a.price), 0);

    return {
      manicuristId: m.id,
      name: m.user.name,
      color: m.color,
      totalAppointments: total,
      completedAppointments: completed.length,
      totalRevenue: revenue,
      avgPerAppointment: completed.length > 0 ? revenue / completed.length : 0,
    };
  });
}
