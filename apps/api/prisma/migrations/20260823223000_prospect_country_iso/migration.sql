-- Normaliza nomes de países legados para códigos ISO
UPDATE "Prospect"
SET "country" = 'BR'
WHERE "country" IS NOT NULL
  AND LOWER(TRIM("country")) IN ('brasil', 'brazil', 'br');

UPDATE "Prospect"
SET "country" = 'PT'
WHERE "country" IS NOT NULL
  AND LOWER(TRIM("country")) IN ('portugal', 'pt');

UPDATE "Prospect"
SET "country" = 'US'
WHERE "country" IS NOT NULL
  AND LOWER(TRIM("country")) IN ('estados unidos', 'united states', 'usa', 'eua', 'us');

UPDATE "Prospect"
SET "country" = 'AR'
WHERE "country" IS NOT NULL
  AND LOWER(TRIM("country")) IN ('argentina', 'ar');

UPDATE "Prospect"
SET "country" = NULL
WHERE "country" IS NOT NULL
  AND LENGTH(TRIM("country")) > 2;
