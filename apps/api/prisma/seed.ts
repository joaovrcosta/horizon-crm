import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ROLES = [
  {
    id: "role_admin",
    slug: "ADMIN",
    name: "Administrador",
    description: "Acesso total ao sistema",
  },
  {
    id: "role_member",
    slug: "MEMBER",
    name: "Membro",
    description: "Acesso operacional",
  },
] as const;

const PERMISSIONS = [
  { id: "perm_users_read", key: "users:read", description: "Listar usuários" },
  { id: "perm_users_create", key: "users:create", description: "Criar usuários" },
  { id: "perm_users_update", key: "users:update", description: "Atualizar usuários" },
  { id: "perm_users_delete", key: "users:delete", description: "Remover usuários" },
  {
    id: "perm_prompts_manage_all",
    key: "prompts:manage_all",
    description: "Gerenciar todos os templates de e-mail",
  },
  {
    id: "perm_vaults_manage_all",
    key: "vaults:manage_all",
    description: "Gerenciar todos os cofres",
  },
  {
    id: "perm_goals_manage",
    key: "goals:manage",
    description: "Configurar metas diárias da equipe",
  },
] as const;

const ADMIN_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

async function seedRbac() {
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { slug: role.slug },
      update: {
        name: role.name,
        description: role.description,
      },
      create: role,
    });
  }

  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { slug: "ADMIN" },
  });

  for (const key of ADMIN_PERMISSION_KEYS) {
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { key },
    });
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: permission.id,
      },
    });
  }

  const deprecatedKeys = ["users:manage_roles", "roles:read"];
  for (const key of deprecatedKeys) {
    const permission = await prisma.permission.findUnique({ where: { key } });
    if (permission) {
      await prisma.rolePermission.deleteMany({
        where: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      });
    }
  }
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@horizon.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "HorizonAdmin123!";
  const name = process.env.SEED_ADMIN_NAME ?? "Admin Horizon";
  const passwordHash = await bcrypt.hash(password, 12);

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { slug: "ADMIN" },
  });

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      roleId: adminRole.id,
    },
    create: {
      email,
      name,
      passwordHash,
      roleId: adminRole.id,
    },
    include: {
      role: { select: { slug: true, name: true } },
    },
  });

  console.log(`Admin seed OK: ${admin.email} (${admin.role.slug})`);
}

async function main() {
  await seedRbac();
  await seedAdmin();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
