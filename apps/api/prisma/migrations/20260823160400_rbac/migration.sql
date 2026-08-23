-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- Seed roles
INSERT INTO "Role" ("id", "slug", "name", "description") VALUES
  ('role_admin', 'ADMIN', 'Administrador', 'Acesso total ao sistema'),
  ('role_member', 'MEMBER', 'Membro', 'Acesso operacional');

-- Seed permissions
INSERT INTO "Permission" ("id", "key", "description") VALUES
  ('perm_users_read', 'users:read', 'Listar usuários'),
  ('perm_users_create', 'users:create', 'Criar usuários'),
  ('perm_users_update', 'users:update', 'Atualizar usuários'),
  ('perm_users_delete', 'users:delete', 'Remover usuários'),
  ('perm_users_manage_roles', 'users:manage_roles', 'Alterar papéis de usuários'),
  ('perm_prompts_manage_all', 'prompts:manage_all', 'Gerenciar todos os prompts'),
  ('perm_roles_read', 'roles:read', 'Listar papéis');

-- ADMIN permissions
INSERT INTO "RolePermission" ("roleId", "permissionId") VALUES
  ('role_admin', 'perm_users_read'),
  ('role_admin', 'perm_users_create'),
  ('role_admin', 'perm_users_update'),
  ('role_admin', 'perm_users_delete'),
  ('role_admin', 'perm_users_manage_roles'),
  ('role_admin', 'perm_prompts_manage_all'),
  ('role_admin', 'perm_roles_read');

-- Add roleId column (nullable during migration)
ALTER TABLE "User" ADD COLUMN "roleId" TEXT;

-- Migrate existing users
UPDATE "User" SET "roleId" = 'role_admin' WHERE "role" = 'ADMIN';
UPDATE "User" SET "roleId" = 'role_member' WHERE "role" = 'MEMBER';

-- Default any remaining users to MEMBER
UPDATE "User" SET "roleId" = 'role_member' WHERE "roleId" IS NULL;

-- Drop old role column and enum
ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "Role";

-- Make roleId required and add FK
ALTER TABLE "User" ALTER COLUMN "roleId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Role_slug_key" ON "Role"("slug");
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
