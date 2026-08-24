-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN "country" TEXT;
ALTER TABLE "Prospect" ADD COLUMN "languages" TEXT[] DEFAULT ARRAY[]::TEXT[];
