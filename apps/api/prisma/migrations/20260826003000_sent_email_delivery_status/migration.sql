-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('SENT', 'DELIVERED', 'BOUNCED', 'FAILED', 'COMPLAINED');

-- AlterTable
ALTER TABLE "SentEmail" ADD COLUMN "deliveryStatus" "EmailDeliveryStatus" NOT NULL DEFAULT 'SENT';
ALTER TABLE "SentEmail" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "SentEmail" ADD COLUMN "deliveryUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "SentEmail_providerId_idx" ON "SentEmail"("providerId");
