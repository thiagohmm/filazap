-- AlterTable
ALTER TABLE "WhatsAppChannel" ADD COLUMN "accessTokenEncrypted" TEXT;
ALTER TABLE "WhatsAppChannel" ADD COLUMN "appSecretEncrypted" TEXT;
ALTER TABLE "WhatsAppChannel" ADD COLUMN "webhookVerifyToken" TEXT;
ALTER TABLE "WhatsAppChannel" ADD COLUMN "apiBaseUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppChannel_webhookVerifyToken_key" ON "WhatsAppChannel"("webhookVerifyToken");
