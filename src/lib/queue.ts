import { Queue, Worker, Job } from "bullmq";

/** Parses REDIS_URL into a plain options object.
 *  BullMQ uses its own bundled ioredis, so passing an external IORedis instance
 *  causes a type conflict. Plain options are always safe. */
export function makeRedisConnection() {
  const raw = process.env.REDIS_URL ?? "redis://localhost:6379";
  try {
    const u = new URL(raw);
    return {
      host: u.hostname || "localhost",
      port: u.port ? parseInt(u.port, 10) : 6379,
      password: u.password || undefined,
      maxRetriesPerRequest: null as null,
    };
  } catch {
    return {
      host: "localhost",
      port: 6379,
      maxRetriesPerRequest: null as null,
    };
  }
}

const connection = makeRedisConnection();

// ─── Queue names ─────────────────────────────────────────────────────────────
export const QUEUE_NAMES = {
  NOTIFICATIONS: "notifications",
  REMINDERS: "reminders",
} as const;

// ─── Job types ────────────────────────────────────────────────────────────────
export type NotificationJobData = {
  appointmentId: string;
  type: "CONFIRMATION" | "REMINDER_24H" | "CANCELLATION";
};

const JOB_DEFAULTS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

// ─── Queues ───────────────────────────────────────────────────────────────────

/** Immediate notifications: confirmations and cancellations (no rate limit). */
export const notificationsQueue = new Queue<NotificationJobData>(
  QUEUE_NAMES.NOTIFICATIONS,
  { connection: makeRedisConnection(), defaultJobOptions: JOB_DEFAULTS }
);

/**
 * Reminder notifications: rate-limited by the worker to 1 per 5 min so
 * that batches of reminders (e.g. many appointments at the same time) are
 * spread out instead of sent all at once.
 */
export const remindersQueue = new Queue<NotificationJobData>(
  QUEUE_NAMES.REMINDERS,
  { connection: makeRedisConnection(), defaultJobOptions: JOB_DEFAULTS }
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Enqueue immediate confirmation message */
export async function enqueueConfirmation(appointmentId: string) {
  return notificationsQueue.add(
    "confirmation",
    { appointmentId, type: "CONFIRMATION" },
    { jobId: `confirm-${appointmentId}` }
  );
}

/**
 * Schedule a reminder for the appointment.
 * - If the appointment is MORE than 24 h away → remind 24 h before.
 * - If the appointment is LESS than 24 h away (but more than 1 h) → remind 1 h before.
 * - If less than 1 h away → no reminder (too late).
 */
export async function scheduleReminder(appointmentId: string, startAt: Date) {
  const now = Date.now();
  const msUntil = startAt.getTime() - now;
  const h24 = 24 * 60 * 60 * 1000;
  const h1 = 1 * 60 * 60 * 1000;

  const reminderBefore = msUntil <= h24 ? h1 : h24;
  const delay = msUntil - reminderBefore;

  if (delay <= 0) return null;

  return remindersQueue.add(
    "reminder",
    { appointmentId, type: "REMINDER_24H" },
    { jobId: `reminder-${appointmentId}`, delay }
  );
}

/** Enqueue cancellation message immediately and remove any pending reminder */
export async function enqueueCancellation(appointmentId: string) {
  const pending = await remindersQueue.getJob(`reminder-${appointmentId}`);
  if (pending) await pending.remove();

  return notificationsQueue.add(
    "cancellation",
    { appointmentId, type: "CANCELLATION" },
    { jobId: `cancel-${appointmentId}` }
  );
}

export { connection, Worker, type Job };
