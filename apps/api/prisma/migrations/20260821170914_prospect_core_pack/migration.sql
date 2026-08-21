-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('NOTE', 'CALL', 'WHATSAPP', 'VISIT', 'EMAIL', 'STATUS_CHANGE', 'OTHER');

-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "estimatedValue" DECIMAL(12,2),
ADD COLUMN     "lostReason" TEXT,
ADD COLUMN     "nextContactAt" TIMESTAMP(3),
ADD COLUMN     "phoneDigits" TEXT,
ADD COLUMN     "whatsapp" TEXT;

-- CreateTable
CREATE TABLE "ProspectActivity" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProspectActivity_prospectId_idx" ON "ProspectActivity"("prospectId");

-- CreateIndex
CREATE INDEX "ProspectActivity_userId_idx" ON "ProspectActivity"("userId");

-- CreateIndex
CREATE INDEX "ProspectActivity_createdAt_idx" ON "ProspectActivity"("createdAt");

-- CreateIndex
CREATE INDEX "Prospect_assigneeId_idx" ON "Prospect"("assigneeId");

-- CreateIndex
CREATE INDEX "Prospect_nextContactAt_idx" ON "Prospect"("nextContactAt");

-- CreateIndex
CREATE INDEX "Prospect_phoneDigits_idx" ON "Prospect"("phoneDigits");

-- CreateIndex
CREATE INDEX "Prospect_mapsUrl_idx" ON "Prospect"("mapsUrl");

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectActivity" ADD CONSTRAINT "ProspectActivity_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectActivity" ADD CONSTRAINT "ProspectActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
