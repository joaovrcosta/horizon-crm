-- CreateTable
CREATE TABLE "ProspectFavorite" (
    "userId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectFavorite_pkey" PRIMARY KEY ("userId","prospectId")
);

-- CreateIndex
CREATE INDEX "ProspectFavorite_userId_createdAt_idx" ON "ProspectFavorite"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ProspectFavorite_prospectId_idx" ON "ProspectFavorite"("prospectId");

-- AddForeignKey
ALTER TABLE "ProspectFavorite" ADD CONSTRAINT "ProspectFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectFavorite" ADD CONSTRAINT "ProspectFavorite_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
