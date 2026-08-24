export const PERMISSION_KEYS = [
  "users:read",
  "users:create",
  "users:update",
  "users:delete",
  "prompts:manage_all",
  "vaults:manage_all",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type RolePublic = {
  slug: string;
  name: string;
};

export type AuthSession = {
  user: {
    id: string;
    email: string;
    name: string;
    role: RolePublic;
    createdAt: string;
  };
  permissions: PermissionKey[];
};

export function hasPermission(
  permissions: readonly string[],
  key: PermissionKey,
): boolean {
  return permissions.includes(key);
}

export function hasAnyPermission(
  permissions: readonly string[],
  keys: readonly PermissionKey[],
): boolean {
  return keys.some((key) => permissions.includes(key));
}
