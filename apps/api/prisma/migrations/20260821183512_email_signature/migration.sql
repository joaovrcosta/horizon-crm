-- CreateTable
CREATE TABLE "EmailSignature" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "displayName" TEXT,
    "title" TEXT,
    "phone" TEXT,
    "logoUrl" TEXT DEFAULT '/brand/halk-logo.png',
    "company" TEXT,
    "tagline" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "website" TEXT,
    "defaultIntro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailSignature_userId_key" ON "EmailSignature"("userId");

-- AddForeignKey
ALTER TABLE "EmailSignature" ADD CONSTRAINT "EmailSignature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
