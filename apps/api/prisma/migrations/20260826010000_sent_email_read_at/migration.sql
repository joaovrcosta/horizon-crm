-- AlterTable
ALTER TABLE "SentEmail" ADD COLUMN "readAt" TIMESTAMP(3);

-- E-mails já existentes ficam como lidos para não “reabrir” a lista inteira
UPDATE "SentEmail" SET "readAt" = "createdAt" WHERE "readAt" IS NULL;
