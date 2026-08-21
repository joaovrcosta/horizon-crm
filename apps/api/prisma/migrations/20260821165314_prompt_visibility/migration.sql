-- CreateEnum
CREATE TYPE "PromptVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "Prompt" ADD COLUMN     "visibility" "PromptVisibility" NOT NULL DEFAULT 'PRIVATE';

-- CreateIndex
CREATE INDEX "Prompt_visibility_idx" ON "Prompt"("visibility");
