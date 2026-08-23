-- Remove global default logo from EmailSignature (per-user configuration)
ALTER TABLE "EmailSignature" ALTER COLUMN "logoUrl" DROP DEFAULT;
