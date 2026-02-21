/**
 * BullMQ Worker — standalone process.
 *
 * Run with:  npm run worker
 *
 * Two workers:
 *   - notificationsWorker  → confirmations & cancellations, sent immediately.
 *   - remindersWorker      → reminders, rate-limited to 1 per 5 min so that
 *                            batches are spread out.
 *
 * Also runs autoCompleteExpiredAppointments every 60 s so that appointments
 * whose end time has passed are automatically marked COMPLETED (and their
 * price counted toward revenue).
 */

import "dotenv/config";
import { Worker, makeRedisConnection, QUEUE_NAMES, type NotificationJobData } from "@/lib/queue";
import { processNotification } from "@/services/notification.service";
import { autoCompleteExpiredAppointments } from "@/services/appointment.service";

console.log("🚀 BullMQ Worker starting...");

// ─── Immediate notifications (confirmations & cancellations) ──────────────────
const notificationsWorker = new Worker<NotificationJobData>(
  QUEUE_NAMES.NOTIFICATIONS,
  async (job) => {
    console.log(`[Worker] Processing job ${job.id} — type: ${job.data.type}`);
    await processNotification(job.data.appointmentId, job.data.type);
  },
  {
    connection: makeRedisConnection(),
    concurrency: 5,
  }
);

// ─── Reminders — max 1 message per 5 minutes ──────────────────────────────────
const remindersWorker = new Worker<NotificationJobData>(
  QUEUE_NAMES.REMINDERS,
  async (job) => {
    console.log(`[Worker] Processing reminder ${job.id} — type: ${job.data.type}`);
    await processNotification(job.data.appointmentId, job.data.type);
  },
  {
    connection: makeRedisConnection(),
    concurrency: 1,
    limiter: {
      max: 1,
      duration: 5 * 60 * 1000, // 1 message per 5 minutes
    },
  }
);

// ─── Auto-complete cron (every 60 s) ──────────────────────────────────────────
async function runAutoComplete() {
  try {
    const count = await autoCompleteExpiredAppointments();
    if (count > 0) {
      console.log(`[Worker] ✅ Auto-completed ${count} expired appointment(s)`);
    }
  } catch (err) {
    console.error("[Worker] Auto-complete error:", err);
  }
}

runAutoComplete(); // run once on startup
setInterval(runAutoComplete, 60 * 1000);

// ─── Event handlers ───────────────────────────────────────────────────────────
for (const w of [notificationsWorker, remindersWorker]) {
  w.on("completed", (job) => {
    console.log(`[Worker] ✅ Job ${job.id} completed`);
  });
  w.on("failed", (job, err) => {
    console.error(`[Worker] ❌ Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
  });
  w.on("error", (err) => {
    console.error("[Worker] Unexpected error:", err);
  });
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown() {
  console.log("[Worker] Shutting down...");
  await Promise.all([notificationsWorker.close(), remindersWorker.close()]);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
