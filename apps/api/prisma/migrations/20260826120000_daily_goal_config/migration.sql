-- CreateTable
CREATE TABLE "DailyGoalConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetCount" INTEGER NOT NULL DEFAULT 5,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyGoalConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyGoalConfig_userId_key" ON "DailyGoalConfig"("userId");

-- CreateIndex
CREATE INDEX "DailyGoalConfig_enabled_idx" ON "DailyGoalConfig"("enabled");

-- AddForeignKey
ALTER TABLE "DailyGoalConfig" ADD CONSTRAINT "DailyGoalConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Permission goals:manage for admin
INSERT INTO "Permission" ("id", "key", "description")
VALUES ('perm_goals_manage', 'goals:manage', 'Configurar metas diárias da equipe')
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description";

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r.slug = 'ADMIN' AND p.key = 'goals:manage'
ON CONFLICT DO NOTHING;
