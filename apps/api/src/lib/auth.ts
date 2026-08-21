import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import type { UserPublic } from "@horizon/shared";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES ?? "15m";
const REFRESH_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? 7);

export type AccessPayload = {
  sub: string;
  email: string;
  role: Role;
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

export function toUserPublic(user: {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: Date;
}): UserPublic {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

export const REFRESH_COOKIE = "horizon_refresh";
