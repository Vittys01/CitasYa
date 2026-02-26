-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MANICURIST', 'RECEPTIONIST');
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "NotificationType" AS ENUM ('CONFIRMATION', 'REMINDER_24H', 'CANCELLATION');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- ─── User ─────────────────────────────────────────────────────────────────────

CREATE TABLE "User" (
    "id"          TEXT NOT NULL,
    "email"       TEXT NOT NULL,
    "password"    TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "role"        "Role" NOT NULL DEFAULT 'RECEPTIONIST',
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "avatarUrl"   TEXT,
    "businessId"  TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_email_idx"      ON "User"("email");
CREATE INDEX "User_role_idx"       ON "User"("role");
CREATE INDEX "User_businessId_idx" ON "User"("businessId");

-- ─── Business ─────────────────────────────────────────────────────────────────

CREATE TABLE "Business" (
    "id"                   TEXT NOT NULL,
    "name"                 TEXT NOT NULL,
    "slug"                 TEXT NOT NULL,
    "isActive"             BOOLEAN NOT NULL DEFAULT true,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,
    "ownerId"              TEXT NOT NULL,
    "whatsappProvider"     TEXT,
    "whatsappInstanceName" TEXT,
    "metaPhoneNumberId"    TEXT,
    "metaAccessToken"      TEXT,
    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Business_slug_key" ON "Business"("slug");
CREATE INDEX "Business_ownerId_idx" ON "Business"("ownerId");
CREATE INDEX "Business_slug_idx"    ON "Business"("slug");

-- ─── Session ──────────────────────────────────────────────────────────────────

CREATE TABLE "Session" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "token"     TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Session_token_key"  ON "Session"("token");
CREATE INDEX "Session_token_idx"         ON "Session"("token");
CREATE INDEX "Session_userId_idx"        ON "Session"("userId");

-- ─── Manicurist ───────────────────────────────────────────────────────────────

CREATE TABLE "Manicurist" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "bio"        TEXT,
    "color"      TEXT NOT NULL DEFAULT '#ec4899',
    "isActive"   BOOLEAN NOT NULL DEFAULT true,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Manicurist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Manicurist_userId_key"  ON "Manicurist"("userId");
CREATE INDEX "Manicurist_businessId_idx"     ON "Manicurist"("businessId");
CREATE INDEX "Manicurist_isActive_idx"       ON "Manicurist"("isActive");

-- ─── Schedule ─────────────────────────────────────────────────────────────────

CREATE TABLE "Schedule" (
    "id"           TEXT NOT NULL,
    "manicuristId" TEXT NOT NULL,
    "dayOfWeek"    INTEGER NOT NULL,
    "startTime"    TEXT NOT NULL,
    "endTime"      TEXT NOT NULL,
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Schedule_manicuristId_dayOfWeek_key" ON "Schedule"("manicuristId", "dayOfWeek");
CREATE INDEX "Schedule_manicuristId_idx" ON "Schedule"("manicuristId");

-- ─── BlockedTime ──────────────────────────────────────────────────────────────

CREATE TABLE "BlockedTime" (
    "id"           TEXT NOT NULL,
    "manicuristId" TEXT NOT NULL,
    "startAt"      TIMESTAMP(3) NOT NULL,
    "endAt"        TIMESTAMP(3) NOT NULL,
    "reason"       TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BlockedTime_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BlockedTime_manicuristId_startAt_endAt_idx" ON "BlockedTime"("manicuristId", "startAt", "endAt");

-- ─── Service ──────────────────────────────────────────────────────────────────

CREATE TABLE "Service" (
    "id"          TEXT NOT NULL,
    "businessId"  TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "duration"    INTEGER NOT NULL,
    "price"       DECIMAL(10,2) NOT NULL,
    "color"       TEXT NOT NULL DEFAULT '#a855f7',
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Service_businessId_idx" ON "Service"("businessId");
CREATE INDEX "Service_isActive_idx"   ON "Service"("isActive");

-- ─── Client ───────────────────────────────────────────────────────────────────

CREATE TABLE "Client" (
    "id"         TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "phone"      TEXT NOT NULL,
    "email"      TEXT,
    "notes"      TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Client_businessId_phone_key" ON "Client"("businessId", "phone");
CREATE INDEX "Client_businessId_idx" ON "Client"("businessId");
CREATE INDEX "Client_name_idx"       ON "Client"("name");

-- ─── Appointment ──────────────────────────────────────────────────────────────

CREATE TABLE "Appointment" (
    "id"           TEXT NOT NULL,
    "businessId"   TEXT NOT NULL,
    "clientId"     TEXT NOT NULL,
    "manicuristId" TEXT NOT NULL,
    "serviceId"    TEXT NOT NULL,
    "startAt"      TIMESTAMP(3) NOT NULL,
    "endAt"        TIMESTAMP(3) NOT NULL,
    "status"       "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "price"        DECIMAL(10,2) NOT NULL,
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Appointment_businessId_idx"        ON "Appointment"("businessId");
CREATE INDEX "Appointment_manicuristId_startAt_idx" ON "Appointment"("manicuristId", "startAt");
CREATE INDEX "Appointment_clientId_idx"          ON "Appointment"("clientId");
CREATE INDEX "Appointment_startAt_idx"           ON "Appointment"("startAt");
CREATE INDEX "Appointment_status_idx"            ON "Appointment"("status");

-- ─── AppSetting ───────────────────────────────────────────────────────────────

CREATE TABLE "AppSetting" (
    "id"         TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "key"        TEXT NOT NULL,
    "value"      TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppSetting_businessId_key_key" ON "AppSetting"("businessId", "key");
CREATE INDEX "AppSetting_businessId_idx"            ON "AppSetting"("businessId");

-- ─── Notification ─────────────────────────────────────────────────────────────

CREATE TABLE "Notification" (
    "id"            TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "type"          "NotificationType" NOT NULL,
    "status"        "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "externalId"    TEXT,
    "error"         TEXT,
    "scheduledFor"  TIMESTAMP(3),
    "sentAt"        TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_appointmentId_idx"        ON "Notification"("appointmentId");
CREATE INDEX "Notification_status_scheduledFor_idx"  ON "Notification"("status", "scheduledFor");
CREATE INDEX "Notification_type_idx"                 ON "Notification"("type");

-- ─── Seed: default owner + business ──────────────────────────────────────────

-- Create default owner user (password: Admin1234)
INSERT INTO "User" ("id", "email", "password", "name", "role", "isActive", "createdAt", "updatedAt")
VALUES (
    gen_random_uuid()::text,
    'admin@dates.app',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.G0nB7YJKZGPnOe',
    'Admin',
    'OWNER',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO NOTHING;

-- Create default business linked to that owner
INSERT INTO "Business" ("id", "name", "slug", "ownerId", "isActive", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    'Mi Empresa',
    'default',
    "id",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User" WHERE "email" = 'admin@dates.app'
ON CONFLICT ("slug") DO NOTHING;

-- ─── Foreign Keys ─────────────────────────────────────────────────────────────

ALTER TABLE "Business"    ADD CONSTRAINT "Business_ownerId_fkey"       FOREIGN KEY ("ownerId")       REFERENCES "User"("id")       ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "User"        ADD CONSTRAINT "User_businessId_fkey"        FOREIGN KEY ("businessId")    REFERENCES "Business"("id")   ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Session"     ADD CONSTRAINT "Session_userId_fkey"         FOREIGN KEY ("userId")        REFERENCES "User"("id")       ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "Manicurist"  ADD CONSTRAINT "Manicurist_userId_fkey"      FOREIGN KEY ("userId")        REFERENCES "User"("id")       ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "Manicurist"  ADD CONSTRAINT "Manicurist_businessId_fkey"  FOREIGN KEY ("businessId")    REFERENCES "Business"("id")   ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "Schedule"    ADD CONSTRAINT "Schedule_manicuristId_fkey"  FOREIGN KEY ("manicuristId")  REFERENCES "Manicurist"("id") ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "BlockedTime" ADD CONSTRAINT "BlockedTime_manicuristId_fkey" FOREIGN KEY ("manicuristId") REFERENCES "Manicurist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Service"     ADD CONSTRAINT "Service_businessId_fkey"     FOREIGN KEY ("businessId")    REFERENCES "Business"("id")   ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "Client"      ADD CONSTRAINT "Client_businessId_fkey"      FOREIGN KEY ("businessId")    REFERENCES "Business"("id")   ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clientId_fkey"     FOREIGN KEY ("clientId")     REFERENCES "Client"("id")     ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_manicuristId_fkey" FOREIGN KEY ("manicuristId") REFERENCES "Manicurist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey"    FOREIGN KEY ("serviceId")    REFERENCES "Service"("id")    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_businessId_fkey"   FOREIGN KEY ("businessId")   REFERENCES "Business"("id")   ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "AppSetting"  ADD CONSTRAINT "AppSetting_businessId_fkey"  FOREIGN KEY ("businessId")    REFERENCES "Business"("id")   ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
