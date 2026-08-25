-- CreateEnum
CREATE TYPE "SiteQuality" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN "siteQuality" "SiteQuality";
