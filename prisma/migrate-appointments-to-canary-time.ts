/**
 * Script de migración para ajustar las fechas de citas a la zona horaria de Canarias
 *
 * Problema: Las citas creadas originalmente se guardaron con la hora de Colombia (UTC-5)
 * Solución: Ajustar las fechas restando 6 horas (diferencia entre Colombia UTC-5 y Canarias UTC+1)
 *
 * USO:
 * npx tsx prisma/migrate-appointments-to-canary-time.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Ajusta una fecha de Colombia a Canarias
 * Colombia: UTC-5
 * Canarias: UTC+1 (GMT+1)
 * Diferencia: +6 horas (Canarias es 6 horas adelante de Colombia)
 *
 * Si una cita está guardada como hora de Colombia pero se interpretó como UTC,
 * necesitamos restar 6 horas para obtener la hora correcta en UTC.
 */
function adjustFromColombiaToCanary(date: Date): Date {
  // Restar 6 horas para ajustar de Colombia a UTC
  const adjusted = new Date(date.getTime() - 6 * 60 * 60 * 1000);
  return adjusted;
}

async function migrateAppointments() {
  console.log("🔄 Iniciando migración de citas a zona horaria de Canarias...");

  try {
    // Obtener todas las citas
    const appointments = await prisma.appointment.findMany({
      select: {
        id: true,
        startAt: true,
        endAt: true,
        status: true,
        client: {
          select: {
            name: true,
          },
        },
      },
    });

    console.log(`📊 Encontradas ${appointments.length} citas para migrar`);

    let updated = 0;
    let skipped = 0;

    for (const appointment of appointments) {
      const originalStart = new Date(appointment.startAt);
      const originalEnd = new Date(appointment.endAt);

      const newStart = adjustFromColombiaToCanary(originalStart);
      const newEnd = adjustFromColombiaToCanary(originalEnd);

      // Verificar si ya fue migrada (si la fecha es muy antigua, probablemente ya fue migrada)
      const now = new Date();
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      if (newStart < oneYearAgo && appointment.status === "COMPLETED") {
        console.log(`⏭️  Skipping ${appointment.id} - probablemente ya migrada`);
        skipped++;
        continue;
      }

      // Actualizar la cita
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          startAt: newStart,
          endAt: newEnd,
        },
      });

      console.log(`✅ Actualizada cita ${appointment.id} (${appointment.client.name})`);
      console.log(`   Antes: ${originalStart.toISOString()} - ${originalEnd.toISOString()}`);
      console.log(`   Después: ${newStart.toISOString()} - ${newEnd.toISOString()}`);
      updated++;
    }

    console.log(`\n✨ Migración completada:`);
    console.log(`   📝 Citas actualizadas: ${updated}`);
    console.log(`   ⏭️  Citas saltadas: ${skipped}`);
    console.log(`   📊 Total procesadas: ${appointments.length}`);

  } catch (error) {
    console.error("❌ Error durante la migración:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la migración
migrateAppointments()
  .then(() => {
    console.log("✅ Migración completada exitosamente");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error en la migración:", error);
    process.exit(1);
  });
