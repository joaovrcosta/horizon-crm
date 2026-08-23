import type { PermissionKey } from "@horizon/shared";
import { prisma } from "./prisma";

const cache = new Map<string, Set<PermissionKey>>();

export async function loadPermissionCache(): Promise<void> {
  const roles = await prisma.role.findMany({
    include: {
      permissions: {
        include: { permission: true },
      },
    },
  });

  cache.clear();
  for (const role of roles) {
    cache.set(
      role.slug,
      new Set(role.permissions.map((rp) => rp.permission.key as PermissionKey)),
    );
  }
}

export function invalidatePermissionCache(): void {
  cache.clear();
}

export async function getPermissionsForRole(
  roleSlug: string,
): Promise<PermissionKey[]> {
  if (cache.size === 0) {
    await loadPermissionCache();
  }

  const permissions = cache.get(roleSlug);
  if (!permissions) {
    await loadPermissionCache();
    return [...(cache.get(roleSlug) ?? [])];
  }

  return [...permissions];
}
