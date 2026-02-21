/**
 * Reminder cron job — scans upcoming appointments and re-schedules
 * any reminder that wasn't enqueued (e.g. server restart, missed job).
 *
 * Run via cron every 15 minutes or on server startup.
 *
 * This is a safety net: the primary scheduling happens in
 * appointment.service.ts → createAppointment().
 */

import { prisma } from "@/lib/db";
import { scheduleReminder } from "@/lib/queue";

export async function reconcileReminders(): Promise<void> {
  const hoursBeforeMs =
    parseInt(process.env.REMINDER_HOURS_BEFORE ?? "24") * 60 * 60 * 1000;

  const windowStart = new Date(Date.now() + hoursBeforeMs - 15 * 60 * 1000);
  const windowEnd = new Date(Date.now() + hoursBeforeMs + 60 * 60 * 1000);

  // Find upcoming appointments in the reminder window that have no REMINDER_24H sent yet
  const appointments = await prisma.appointment.findMany({
    where: {
      startAt: { gte: windowStart, lte: windowEnd },
      status: { in: ["PENDING", "CONFIRMED"] },
      notifications: {
        none: {
          type: "REMINDER_24H",
          status: { in: ["SENT", "PENDING"] },
        },
      },
    },
    select: { id: true, startAt: true },
  });

  console.log(`[ReminderJob] Found ${appointments.length} appointments needing reminders`);

  for (const appt of appointments) {
    await scheduleReminder(appt.id, appt.startAt);
  }
}
