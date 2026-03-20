-- Populate AppointmentService from existing Appointments (one service per appointment)
INSERT INTO "AppointmentService" ("id", "appointmentId", "serviceId", "durationMinutes", "price", "sortOrder")
SELECT
  'c' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
  a."id",
  a."serviceId",
  s."duration",
  a."price",
  0
FROM "Appointment" a
JOIN "Service" s ON s."id" = a."serviceId"
WHERE NOT EXISTS (
  SELECT 1 FROM "AppointmentService" asp WHERE asp."appointmentId" = a."id"
);
