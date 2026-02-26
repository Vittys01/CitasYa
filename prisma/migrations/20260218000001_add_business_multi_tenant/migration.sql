-- Create Business table (OWNER enum value added in previous migration)
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,
    "whatsappProvider" TEXT,
    "whatsappInstanceName" TEXT,
    "metaPhoneNumberId" TEXT,
    "metaAccessToken" TEXT,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Business_slug_key" ON "Business"("slug");
CREATE INDEX "Business_ownerId_idx" ON "Business"("ownerId");
CREATE INDEX "Business_slug_idx" ON "Business"("slug");

-- Add businessId to User (nullable first)
ALTER TABLE "User" ADD COLUMN "businessId" TEXT;

-- Ensure at least one user exists (for fresh DB / migrate reset): create default owner
INSERT INTO "User" ("id", "email", "password", "name", "role", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'admin@dates.app', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.G0nB7YJKZGPnOe', 'Admin', 'ADMIN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "User" LIMIT 1);

-- Create default business: use first ADMIN as owner, or first User
INSERT INTO "Business" ("id", "name", "slug", "ownerId", "isActive", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    'Mi Empresa',
    'default',
    (SELECT "id" FROM "User" ORDER BY CASE WHEN "role" = 'ADMIN' THEN 0 ELSE 1 END LIMIT 1),
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP;

-- Set that user as OWNER and clear businessId
UPDATE "User" SET "role" = 'OWNER', "businessId" = NULL
WHERE "id" = (SELECT "ownerId" FROM "Business" WHERE "slug" = 'default' LIMIT 1);

-- All other users (ADMIN/RECEPTIONIST) get the default business
UPDATE "User" SET "businessId" = (SELECT "id" FROM "Business" WHERE "slug" = 'default' LIMIT 1)
WHERE "businessId" IS NULL AND "role" != 'OWNER';

-- Add businessId to Manicurist, Client, Service, Appointment, AppSetting (nullable)
ALTER TABLE "Manicurist" ADD COLUMN "businessId" TEXT;
ALTER TABLE "Client" ADD COLUMN "businessId" TEXT;
ALTER TABLE "Service" ADD COLUMN "serviceBusinessId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "appointmentBusinessId" TEXT;
ALTER TABLE "AppSetting" ADD COLUMN "appSettingBusinessId" TEXT;

-- Backfill: set all to default business
UPDATE "Manicurist" SET "businessId" = (SELECT "id" FROM "Business" WHERE "slug" = 'default' LIMIT 1);
UPDATE "Client" SET "businessId" = (SELECT "id" FROM "Business" WHERE "slug" = 'default' LIMIT 1);
UPDATE "Service" SET "serviceBusinessId" = (SELECT "id" FROM "Business" WHERE "slug" = 'default' LIMIT 1);
UPDATE "Appointment" SET "appointmentBusinessId" = (SELECT "id" FROM "Business" WHERE "slug" = 'default' LIMIT 1);
UPDATE "AppSetting" SET "appSettingBusinessId" = (SELECT "id" FROM "Business" WHERE "slug" = 'default' LIMIT 1);

-- Rename columns to final names (Prisma expects businessId)
ALTER TABLE "Service" RENAME COLUMN "serviceBusinessId" TO "businessId";
ALTER TABLE "Appointment" RENAME COLUMN "appointmentBusinessId" TO "businessId";
ALTER TABLE "AppSetting" RENAME COLUMN "appSettingBusinessId" TO "businessId";

-- Make NOT NULL
ALTER TABLE "Manicurist" ALTER COLUMN "businessId" SET NOT NULL;
ALTER TABLE "Client" ALTER COLUMN "businessId" SET NOT NULL;
ALTER TABLE "Service" ALTER COLUMN "businessId" SET NOT NULL;
ALTER TABLE "Appointment" ALTER COLUMN "businessId" SET NOT NULL;
ALTER TABLE "AppSetting" ALTER COLUMN "businessId" SET NOT NULL;

-- Drop old unique constraints
ALTER TABLE "Client" DROP CONSTRAINT IF EXISTS "Client_phone_key";
DROP INDEX IF EXISTS "AppSetting_key_key";

-- Add new unique constraints
CREATE UNIQUE INDEX "Client_businessId_phone_key" ON "Client"("businessId", "phone");
CREATE UNIQUE INDEX "AppSetting_businessId_key_key" ON "AppSetting"("businessId", "key");

-- Add indexes
CREATE INDEX "Manicurist_businessId_idx" ON "Manicurist"("businessId");
CREATE INDEX "Client_businessId_idx" ON "Client"("businessId");
CREATE INDEX "Service_businessId_idx" ON "Service"("businessId");
CREATE INDEX "Appointment_businessId_idx" ON "Appointment"("businessId");
CREATE INDEX "AppSetting_businessId_idx" ON "AppSetting"("businessId");

-- Add foreign keys
ALTER TABLE "Business" ADD CONSTRAINT "Business_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Manicurist" ADD CONSTRAINT "Manicurist_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppSetting" ADD CONSTRAINT "AppSetting_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
