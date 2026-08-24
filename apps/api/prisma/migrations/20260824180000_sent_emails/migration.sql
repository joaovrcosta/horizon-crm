-- CreateTable
CREATE TABLE "SentEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prospectId" TEXT,
    "toEmail" TEXT NOT NULL,
    "toName" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "replyTo" TEXT,
    "providerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SentEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SentEmail_userId_createdAt_idx" ON "SentEmail"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SentEmail_prospectId_idx" ON "SentEmail"("prospectId");

-- CreateIndex
CREATE INDEX "SentEmail_createdAt_idx" ON "SentEmail"("createdAt");

-- CreateIndex
CREATE INDEX "SentEmail_toEmail_idx" ON "SentEmail"("toEmail");

-- AddForeignKey
ALTER TABLE "SentEmail" ADD CONSTRAINT "SentEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentEmail" ADD CONSTRAINT "SentEmail_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
