/**
 * Proceso en segundo plano (sin Redis): auto-completar citas pasadas y
 * reconciliar recordatorios si el servidor se reinició.
 *
 * Ejecutar: pnpm run worker
 */

import "dotenv/config";
import { autoCompleteExpiredAppointments } from "@/services/appointment.service";
import { reconcileReminders } from "@/jobs/reminder.job";

console.log("🚀 Background worker starting (no Redis)...");

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

async function runReconcile() {
  try {
    await reconcileReminders();
  } catch (err) {
    console.error("[Worker] Reconcile reminders error:", err);
  }
}

runAutoComplete();
runReconcile();

setInterval(runAutoComplete, 60 * 1000);
setInterval(runReconcile, 15 * 60 * 1000);

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
