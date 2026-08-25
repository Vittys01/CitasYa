-- AlterTable: add manicuristId to AppointmentService (nullable)
ALTER TABLE "AppointmentService" ADD COLUMN "manicuristId" TEXT;

-- CreateIndex
CREATE INDEX "AppointmentService_manicuristId_idx" ON "AppointmentService"("manicuristId");

-- AddForeignKey
ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_manicuristId_fkey"
  FOREIGN KEY ("manicuristId") REFERENCES "Manicurist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
