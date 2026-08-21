-- CreateTable
CREATE TABLE "TeamPresence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamPresence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamChatMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamPresence_organizationId_userId_key" ON "TeamPresence"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "TeamPresence_organizationId_lastSeenAt_idx" ON "TeamPresence"("organizationId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "TeamChatMessage_organizationId_createdAt_idx" ON "TeamChatMessage"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "TeamChatMessage_organizationId_recipientUserId_createdAt_idx" ON "TeamChatMessage"("organizationId", "recipientUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "TeamPresence" ADD CONSTRAINT "TeamPresence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPresence" ADD CONSTRAINT "TeamPresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamChatMessage" ADD CONSTRAINT "TeamChatMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamChatMessage" ADD CONSTRAINT "TeamChatMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamChatMessage" ADD CONSTRAINT "TeamChatMessage_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
