/**
 * Meta WhatsApp Cloud API webhook endpoint.
 * - GET:  Webhook verification challenge
 * - POST: Incoming message events - saves messages to database and triggers bot
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveIncomingMessage } from "@/services/whatsapp-chat.service";
import { handleWhatsAppMessage } from "@/services/whatsapp-bot.service";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    console.log("[Webhook] Meta webhook verified");
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[Webhook] Incoming WhatsApp event:", JSON.stringify(body, null, 2));

    // Extract messages from webhook payload
    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field === "messages") {
          const value = change.value;
          const messages = value.messages || [];

          for (const msg of messages) {
            // Get business ID from phone number ID
            const phoneNumberId = value.metadata.phone_number_id;

            // Find business by Meta phone number ID
            const business = await prisma.business.findFirst({
              where: {
                metaPhoneNumberId: phoneNumberId,
                isActive: true,
              },
            });

            if (!business) {
              console.log("[Webhook] Business not found for phone number ID:", phoneNumberId);
              continue;
            }

            // Extract message details
            const from = msg.from; // E.164 format from Meta
            const text = msg.text?.body || "";
            const messageId = msg.id;
            const timestamp = msg.timestamp;

            if (!from || !text) {
              console.log("[Webhook] Missing required fields in message");
              continue;
            }

            // Save incoming message to database
            await saveIncomingMessage(
              business.id,
              from,
              text,
              {
                provider: "meta",
                messageId,
                timestamp,
              },
              messageId
            );

            console.log("[Webhook] Message saved from:", from, "to business:", business.name);

            // Trigger WhatsApp bot to process the message
            try {
              await handleWhatsAppMessage({
                businessId: business.id,
                phoneE164: from,
                text,
              });
            } catch (botError) {
              console.error("[Webhook] Error processing bot message:", botError);
              // Don't fail the webhook response if bot fails
            }
          }
        }
      }
    }

    // Always return 200 quickly so Meta doesn't retry
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    // Still return 200 to avoid retries from Meta
    return NextResponse.json({ received: true });
  }
}
