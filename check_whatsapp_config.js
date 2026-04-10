/**
 * Script para verificar la configuración de WhatsApp en la base de datos
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkConfig() {
  try {
    console.log('📱 Verificando configuración de WhatsApp en negocios:\n');

    // Buscar todos los negocios
    const businesses = await prisma.business.findMany({
      select: {
        id: true,
        name: true,
        twilioWhatsAppNumber: true,
        metaPhoneNumberId: true,
        isActive: true
      }
    });

    console.log(`Total de negocios: ${businesses.length}\n`);

    businesses.forEach(b => {
      console.log(`🏢 ${b.name} (${b.id})`);
      console.log(`   twilioWhatsAppNumber: ${b.twilioWhatsAppNumber || '❌ No configurado'}`);
      console.log(`   metaPhoneNumberId: ${b.metaPhoneNumberId || '❌ No configurado'}`);
      console.log(`   isActive: ${b.isActive ? '✅' : '❌'}`);
      console.log('');
    });

    // Buscar mensajes guardados
    const messages = await prisma.whatsAppMessage.findMany({
      include: {
        business: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });

    console.log(`\n📨 Mensajes guardados: ${messages.length}`);
    if (messages.length > 0) {
      messages.forEach((msg, idx) => {
        console.log(`\n${idx + 1}. ${msg.business.name} | ${msg.phoneE164} | ${msg.direction}`);
        console.log(`   Contenido: ${msg.content}`);
        console.log(`   Status: ${msg.status} | Extern ID: ${msg.externalId || 'N/A'}`);
        console.log(`   Creado: ${msg.createdAt.toISOString()}`);
      });
    } else {
      console.log('❌ No hay mensajes guardados');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkConfig();
