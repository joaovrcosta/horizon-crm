-- CreateTable
CREATE TABLE "ReceivedEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "prospectId" TEXT,
    "sentEmailId" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isReply" BOOLEAN NOT NULL DEFAULT true,
    "providerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceivedEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReceivedEmail_providerId_key" ON "ReceivedEmail"("providerId");

-- CreateIndex
CREATE INDEX "ReceivedEmail_userId_createdAt_idx" ON "ReceivedEmail"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ReceivedEmail_prospectId_idx" ON "ReceivedEmail"("prospectId");

-- CreateIndex
CREATE INDEX "ReceivedEmail_sentEmailId_idx" ON "ReceivedEmail"("sentEmailId");

-- CreateIndex
CREATE INDEX "ReceivedEmail_fromEmail_idx" ON "ReceivedEmail"("fromEmail");

-- CreateIndex
CREATE INDEX "ReceivedEmail_createdAt_idx" ON "ReceivedEmail"("createdAt");

-- AddForeignKey
ALTER TABLE "ReceivedEmail" ADD CONSTRAINT "ReceivedEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivedEmail" ADD CONSTRAINT "ReceivedEmail_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivedEmail" ADD CONSTRAINT "ReceivedEmail_sentEmailId_fkey" FOREIGN KEY ("sentEmailId") REFERENCES "SentEmail"("id") ON DELETE SET NULL ON UPDATE CASCADE;
