-- AlterTable: add manicuristId to Invoice
ALTER TABLE "Invoice" ADD COLUMN "manicuristId" TEXT;

-- CreateIndex
CREATE INDEX "Invoice_manicuristId_idx" ON "Invoice"("manicuristId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_manicuristId_fkey" FOREIGN KEY ("manicuristId") REFERENCES "Manicurist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: copy manicuristId from related appointment for existing invoices
UPDATE "Invoice"
SET "manicuristId" = a."manicuristId"
FROM "Appointment" a
WHERE "Invoice"."appointmentId" = a."id"
  AND a."manicuristId" IS NOT NULL;
