-- AlterTable
ALTER TABLE "Prompt" ADD COLUMN "languages" TEXT[] DEFAULT ARRAY[]::TEXT[];
