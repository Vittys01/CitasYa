-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');

-- AlterTable: Business fiscal fields
ALTER TABLE "Business" ADD COLUMN "nif" TEXT;
ALTER TABLE "Business" ADD COLUMN "addressStreet" TEXT;
ALTER TABLE "Business" ADD COLUMN "addressCity" TEXT;
ALTER TABLE "Business" ADD COLUMN "addressProvince" TEXT;
ALTER TABLE "Business" ADD COLUMN "addressPostal" TEXT;
ALTER TABLE "Business" ADD COLUMN "invoicePrefix" TEXT;
ALTER TABLE "Business" ADD COLUMN "nextInvoiceNum" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Business" ADD COLUMN "defaultIvaRate" DECIMAL(5,2) NOT NULL DEFAULT 21;
ALTER TABLE "Business" ADD COLUMN "defaultIrpfRate" DECIMAL(5,2) NOT NULL DEFAULT 15;
ALTER TABLE "Business" ADD COLUMN "invoiceFooter" TEXT;

-- AlterTable: Client NIF
ALTER TABLE "Client" ADD COLUMN "nif" TEXT;

-- CreateTable: Invoice
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT 'F',
    "formattedNumber" TEXT NOT NULL,
    "appointmentId" TEXT,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientNif" TEXT,
    "clientEmail" TEXT,
    "businessName" TEXT NOT NULL,
    "businessNif" TEXT,
    "businessAddress" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "baseImponible" DECIMAL(12,2) NOT NULL,
    "ivaRate" DECIMAL(5,2) NOT NULL,
    "ivaAmount" DECIMAL(12,2) NOT NULL,
    "irpfRate" DECIMAL(5,2) NOT NULL,
    "irpfAmount" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InvoiceItem
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "serviceId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_businessId_number_key" ON "Invoice"("businessId", "number");
CREATE UNIQUE INDEX "Invoice_appointmentId_key" ON "Invoice"("appointmentId");

-- CreateIndex
CREATE INDEX "Invoice_businessId_idx" ON "Invoice"("businessId");
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");
CREATE INDEX "Invoice_appointmentId_idx" ON "Invoice"("appointmentId");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_issuedAt_idx" ON "Invoice"("issuedAt");

CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
