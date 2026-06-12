export async function register() {
  process.env.TZ = "Atlantic/Canary";

  // Auto-complete expired appointments every 60 seconds
  // (no requiere un worker separado)
  const { autoCompleteExpiredAppointments } = await import(
    "@/services/appointment.service"
  );

  const run = () => {
    autoCompleteExpiredAppointments().catch((err) =>
      console.error("[Instrumentation] Auto-complete error:", err)
    );
  };

  run();
  setInterval(run, 60_000);
}
