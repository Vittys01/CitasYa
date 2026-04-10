/**
 * Script para actualizar el negocio con el número de WhatsApp de Twilio
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixConfig() {
  try {
    console.log('🔧 Actualizando configuración de WhatsApp...\n');

    // Buscar el primer negocio activo
    const business = await prisma.business.findFirst({
      where: {
        isActive: true
      }
    });

    if (!business) {
      console.log('❌ No hay negocios activos');
      return;
    }

    console.log(`🏢 Negocio encontrado: ${business.name} (${business.id})`);

    // Actualizar el número de WhatsApp
    const updated = await prisma.business.update({
      where: {
        id: business.id
      },
      data: {
        twilioWhatsAppNumber: 'whatsapp:+16812812834'
      }
    });

    console.log(`✅ Número de WhatsApp actualizado: ${updated.twilioWhatsAppNumber}`);
    console.log(`✅ Ahora el webhook podrá guardar mensajes correctamente\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixConfig();
