-- CreateEnum
CREATE TYPE "ProspectTagKind" AS ENUM ('CATEGORY', 'LANGUAGE');

-- CreateTable
CREATE TABLE "ProspectTag" (
    "id" TEXT NOT NULL,
    "kind" "ProspectTagKind" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProspectTag_kind_slug_key" ON "ProspectTag"("kind", "slug");

-- CreateIndex
CREATE INDEX "ProspectTag_kind_name_idx" ON "ProspectTag"("kind", "name");

-- Backfill categories
INSERT INTO "ProspectTag" ("id", "kind", "name", "slug", "createdAt", "updatedAt")
SELECT
  md5('CATEGORY:' || lower(trim(p."category"))),
  'CATEGORY'::"ProspectTagKind",
  MIN(trim(p."category")),
  lower(trim(p."category")),
  NOW(),
  NOW()
FROM "Prospect" p
WHERE p."category" IS NOT NULL AND trim(p."category") <> ''
GROUP BY lower(trim(p."category"))
ON CONFLICT ("kind", "slug") DO NOTHING;

-- Backfill languages
INSERT INTO "ProspectTag" ("id", "kind", "name", "slug", "createdAt", "updatedAt")
SELECT
  md5('LANGUAGE:' || lower(trim(lang))),
  'LANGUAGE'::"ProspectTagKind",
  MIN(trim(lang)),
  lower(trim(lang)),
  NOW(),
  NOW()
FROM "Prospect" p, unnest(p."languages") AS lang
WHERE trim(lang) <> ''
GROUP BY lower(trim(lang))
ON CONFLICT ("kind", "slug") DO NOTHING;
