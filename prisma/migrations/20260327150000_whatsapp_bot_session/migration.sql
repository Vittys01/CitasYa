-- CreateTable
CREATE TABLE "WhatsAppBotSession" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "step" TEXT NOT NULL DEFAULT 'idle',
    "data" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppBotSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppBotSession_businessId_phoneE164_key" ON "WhatsAppBotSession"("businessId", "phoneE164");

-- CreateIndex
CREATE INDEX "WhatsAppBotSession_businessId_idx" ON "WhatsAppBotSession"("businessId");

-- AddForeignKey
ALTER TABLE "WhatsAppBotSession" ADD CONSTRAINT "WhatsAppBotSession_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
