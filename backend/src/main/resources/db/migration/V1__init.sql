-- FilaZap — schema inicial (espelha o schema Prisma original)
-- Convenções: ids são TEXT (UUID/cuid gerados pela aplicação), timestamps são
-- TIMESTAMPTZ, JSON é JSONB e status/papéis são TEXT validados no domínio.

-- =========================================================
-- User
-- =========================================================
CREATE TABLE "User" (
    id           TEXT PRIMARY KEY,
    email        TEXT NOT NULL UNIQUE,
    name         TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "User_email_idx" ON "User" (email);

-- =========================================================
-- PasswordResetToken
-- =========================================================
CREATE TABLE "PasswordResetToken" (
    id        TEXT PRIMARY KEY,
    "userId"  TEXT NOT NULL UNIQUE REFERENCES "User"(id) ON DELETE CASCADE,
    "tokenHash" TEXT NOT NULL UNIQUE,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "usedAt"  TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken" ("expiresAt");

-- =========================================================
-- Organization
-- =========================================================
CREATE TABLE "Organization" (
    id                 TEXT PRIMARY KEY,
    name               TEXT NOT NULL,
    slug               TEXT NOT NULL UNIQUE,
    timezone           TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    plan               TEXT NOT NULL DEFAULT 'STARTER',
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'TRIAL',
    theme              TEXT NOT NULL DEFAULT 'light',
    "brandColor"       TEXT NOT NULL DEFAULT '#10b981',
    "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- OrganizationMember
-- =========================================================
CREATE TABLE "OrganizationMember" (
    id               TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
    "userId"         TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    role             TEXT NOT NULL DEFAULT 'AGENT',
    active           BOOLEAN NOT NULL DEFAULT true,
    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "OrganizationMember_org_user_unique" UNIQUE ("organizationId", "userId")
);
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember" ("userId");
CREATE INDEX "OrganizationMember_org_role_idx" ON "OrganizationMember" ("organizationId", role);

-- =========================================================
-- TeamPresence
-- =========================================================
CREATE TABLE "TeamPresence" (
    id               TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
    "userId"         TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "lastSeenAt"     TIMESTAMPTZ NOT NULL,
    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "TeamPresence_org_user_unique" UNIQUE ("organizationId", "userId")
);
CREATE INDEX "TeamPresence_org_lastSeen_idx" ON "TeamPresence" ("organizationId", "lastSeenAt");

-- =========================================================
-- TeamChatMessage
-- =========================================================
CREATE TABLE "TeamChatMessage" (
    id                TEXT PRIMARY KEY,
    "organizationId"  TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
    "senderUserId"    TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "recipientUserId" TEXT REFERENCES "User"(id) ON DELETE CASCADE,
    body              TEXT NOT NULL,
    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "TeamChatMessage_org_created_idx" ON "TeamChatMessage" ("organizationId", "createdAt");
CREATE INDEX "TeamChatMessage_org_recipient_idx" ON "TeamChatMessage" ("organizationId", "recipientUserId", "createdAt");

-- =========================================================
-- WhatsAppChannel
-- =========================================================
CREATE TABLE "WhatsAppChannel" (
    id                    TEXT PRIMARY KEY,
    "organizationId"      TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
    "phoneNumberId"       TEXT NOT NULL UNIQUE,
    "businessAccountId"   TEXT NOT NULL,
    "displayPhoneNumber"  TEXT NOT NULL,
    status                TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "accessTokenEncrypted" TEXT,
    "appSecretEncrypted"   TEXT,
    "webhookVerifyToken"   TEXT UNIQUE,
    "apiBaseUrl"           TEXT,
    "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "WhatsAppChannel_org_idx" ON "WhatsAppChannel" ("organizationId");

-- =========================================================
-- Contact
-- =========================================================
CREATE TABLE "Contact" (
    id               TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
    "channelId"      TEXT NOT NULL REFERENCES "WhatsAppChannel"(id) ON DELETE CASCADE,
    "phoneE164"      TEXT NOT NULL,
    name             TEXT,
    metadata         JSONB,
    "firstContactAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "lastContactAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "Contact_org_channel_phone_unique" UNIQUE ("organizationId", "channelId", "phoneE164")
);
CREATE INDEX "Contact_org_phone_idx" ON "Contact" ("organizationId", "phoneE164");
CREATE INDEX "Contact_org_lastContact_idx" ON "Contact" ("organizationId", "lastContactAt");

-- =========================================================
-- Ticket
-- =========================================================
CREATE TABLE "Ticket" (
    id                    TEXT PRIMARY KEY,
    "organizationId"      TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
    "channelId"           TEXT NOT NULL REFERENCES "WhatsAppChannel"(id) ON DELETE CASCADE,
    "contactId"           TEXT NOT NULL REFERENCES "Contact"(id) ON DELETE CASCADE,
    "sequenceNumber"      INTEGER NOT NULL,
    status                TEXT NOT NULL DEFAULT 'WAITING',
    priority              INTEGER NOT NULL DEFAULT 0,
    "queueEnteredAt"      TIMESTAMPTZ NOT NULL,
    "assignedUserId"      TEXT REFERENCES "User"(id) ON DELETE SET NULL,
    "assignedAt"          TIMESTAMPTZ,
    "firstResponseAt"     TIMESTAMPTZ,
    "waitingCustomerSince" TIMESTAMPTZ,
    "finishedAt"          TIMESTAMPTZ,
    "lastMessageAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
    "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "Ticket_org_seq_unique" UNIQUE ("organizationId", "sequenceNumber")
);
CREATE INDEX "Ticket_org_status_priority_idx" ON "Ticket" ("organizationId", status, priority, "queueEnteredAt");
CREATE INDEX "Ticket_org_assigned_idx" ON "Ticket" ("organizationId", "assignedUserId", status, "lastMessageAt");
CREATE INDEX "Ticket_contact_idx" ON "Ticket" ("contactId");

-- =========================================================
-- Message
-- =========================================================
CREATE TABLE "Message" (
    id                   TEXT PRIMARY KEY,
    "organizationId"     TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
    "ticketId"           TEXT NOT NULL REFERENCES "Ticket"(id) ON DELETE CASCADE,
    "contactId"          TEXT NOT NULL REFERENCES "Contact"(id) ON DELETE CASCADE,
    "whatsappMessageId"  TEXT UNIQUE,
    direction            TEXT NOT NULL,
    type                 TEXT NOT NULL DEFAULT 'TEXT',
    body                 TEXT,
    "mediaPath"          TEXT,
    "senderUserId"       TEXT REFERENCES "User"(id) ON DELETE SET NULL,
    "providerStatus"     TEXT,
    "providerTimestamp"  TIMESTAMPTZ,
    "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Message_org_ticket_idx" ON "Message" ("organizationId", "ticketId", "providerTimestamp");

-- =========================================================
-- InternalNote
-- =========================================================
CREATE TABLE "InternalNote" (
    id               TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
    "contactId"      TEXT NOT NULL REFERENCES "Contact"(id) ON DELETE CASCADE,
    "ticketId"       TEXT REFERENCES "Ticket"(id) ON DELETE SET NULL,
    "authorUserId"   TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    body             TEXT NOT NULL,
    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "InternalNote_org_contact_idx" ON "InternalNote" ("organizationId", "contactId");
CREATE INDEX "InternalNote_ticket_idx" ON "InternalNote" ("ticketId");

-- =========================================================
-- TicketEvent
-- =========================================================
CREATE TABLE "TicketEvent" (
    id               TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
    "ticketId"       TEXT NOT NULL REFERENCES "Ticket"(id) ON DELETE CASCADE,
    "actorUserId"    TEXT REFERENCES "User"(id) ON DELETE SET NULL,
    "eventType"      TEXT NOT NULL,
    "fromStatus"     TEXT,
    "toStatus"       TEXT,
    payload          JSONB,
    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "TicketEvent_org_ticket_idx" ON "TicketEvent" ("organizationId", "ticketId", "createdAt");

-- =========================================================
-- WebhookEvent
-- =========================================================
CREATE TABLE "WebhookEvent" (
    id                 TEXT PRIMARY KEY,
    "organizationId"   TEXT REFERENCES "Organization"(id) ON DELETE SET NULL,
    "providerEventId"  TEXT UNIQUE,
    payload            JSONB NOT NULL,
    "processingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    attempts           INTEGER NOT NULL DEFAULT 0,
    "receivedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
    "processedAt"      TIMESTAMPTZ,
    "errorMessage"     TEXT
);
CREATE INDEX "WebhookEvent_org_status_idx" ON "WebhookEvent" ("organizationId", "processingStatus");
CREATE INDEX "WebhookEvent_received_idx" ON "WebhookEvent" ("receivedAt");
