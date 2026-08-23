-- AlterTable
ALTER TABLE "EmailSignature" ADD COLUMN "replyToEmail" TEXT DEFAULT 'hello@halk.solutions';

UPDATE "EmailSignature"
SET "replyToEmail" = 'hello@halk.solutions'
WHERE "replyToEmail" IS NULL;
