import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { RolePublic, UserPublic } from "@horizon/shared";
import { prisma } from "./prisma";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES ?? "15m";
const REFRESH_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? 7);

export type AccessPayload = {
  sub: string;
  email: string;
  roleSlug: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, ACCESS_SECRET) as AccessPayload;
}

export function createRefreshTokenValue(): string {
  return crypto.randomBytes(48).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function getRefreshExpiryDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + REFRESH_DAYS);
  return date;
}

export function toRolePublic(role: { slug: string; name: string }): RolePublic {
  return {
    slug: role.slug,
    name: role.name,
  };
}

export function toUserPublic(user: {
  id: string;
  email: string;
  name: string;
  role: { slug: string; name: string };
  createdAt: Date;
}): UserPublic {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: toRolePublic(user.role),
    createdAt: user.createdAt.toISOString(),
  };
}

const userWithRoleInclude = {
  role: { select: { slug: true, name: true } },
} as const;

export async function findUserWithRole(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: userWithRoleInclude,
  });
}

export async function findRoleBySlug(slug: string) {
  return prisma.role.findUnique({ where: { slug } });
}

export async function createMemberUser(input: {
  email: string;
  name: string;
  password: string;
}) {
  const email = input.email.toLowerCase();

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    throw new Error("EMAIL_TAKEN");
  }

  const memberRole = await findRoleBySlug("MEMBER");
  if (!memberRole) {
    throw new Error("MEMBER_ROLE_MISSING");
  }

  return prisma.user.create({
    data: {
      email,
      name: input.name,
      roleId: memberRole.id,
      passwordHash: await hashPassword(input.password),
    },
    include: userWithRoleInclude,
  });
}

export async function countUsersWithRoleSlug(slug: string): Promise<number> {
  return prisma.user.count({
    where: { role: { slug } },
  });
}

export const REFRESH_COOKIE = "horizon_refresh";
