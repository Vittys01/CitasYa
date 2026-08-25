-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'BIZUM', 'DATAFONO');

-- AlterTable: add paymentMethod to Invoice
ALTER TABLE "Invoice" ADD COLUMN "paymentMethod" "PaymentMethod";

-- AlterTable: add paymentMethod to Appointment
ALTER TABLE "Appointment" ADD COLUMN "paymentMethod" "PaymentMethod";

-- CreateIndex
CREATE INDEX "Invoice_paymentMethod_idx" ON "Invoice"("paymentMethod");
