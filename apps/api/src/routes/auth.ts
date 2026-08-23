import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import type { ApiResponse, AuthLoginResponse, AuthSession } from "@horizon/shared";
import { prisma } from "../lib/prisma";
import {
  REFRESH_COOKIE,
  createMemberUser,
  createRefreshTokenValue,
  getRefreshExpiryDate,
  hashToken,
  signAccessToken,
  toUserPublic,
  verifyPassword,
} from "../lib/auth";
import { AppError } from "../lib/errors";
import { getPermissionsForRole } from "../lib/permissions";
import { requireAuth } from "../middleware/auth";

const router = Router();

const userWithRoleInclude = {
  role: { select: { slug: true, name: true } },
} as const;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(120),
  password: z.string().min(8).max(128),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de login. Tente novamente mais tarde." },
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de cadastro. Tente novamente mais tarde." },
});

function setRefreshCookie(res: import("express").Response, token: string) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/auth",
    maxAge: Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? 7) * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res: import("express").Response) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    path: "/auth",
    secure: process.env.NODE_ENV === "production",
  });
}

function parseRefreshCookie(cookie: string): { id: string; raw: string } | null {
  const sep = cookie.indexOf(".");
  if (sep <= 0) return null;
  return {
    id: cookie.slice(0, sep),
    raw: cookie.slice(sep + 1),
  };
}

async function issueRefreshCookie(userId: string, res: import("express").Response) {
  const rawRefresh = createRefreshTokenValue();
  const record = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(rawRefresh),
      expiresAt: getRefreshExpiryDate(),
    },
  });
  setRefreshCookie(res, `${record.id}.${rawRefresh}`);
}

async function buildAuthSession(userId: string): Promise<AuthSession> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithRoleInclude,
  });

  if (!user) {
    throw new AppError(401, "Usuário não encontrado");
  }

  const permissions = await getPermissionsForRole(user.role.slug);

  return {
    user: toUserPublic(user),
    permissions,
  };
}

router.post("/register", registerLimiter, async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);

    let user;
    try {
      user = await createMemberUser(body);
    } catch (error) {
      if (error instanceof Error && error.message === "EMAIL_TAKEN") {
        throw new AppError(409, "Email já cadastrado");
      }
      if (error instanceof Error && error.message === "MEMBER_ROLE_MISSING") {
        throw new AppError(500, "Papel MEMBER não configurado");
      }
      throw error;
    }

    const permissions = await getPermissionsForRole(user.role.slug);

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      roleSlug: user.role.slug,
    });

    await issueRefreshCookie(user.id, res);

    const payload: ApiResponse<AuthLoginResponse> = {
      data: {
        accessToken,
        user: toUserPublic(user),
        permissions,
      },
    };
    res.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      include: userWithRoleInclude,
    });

    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new AppError(401, "Email ou senha inválidos");
    }

    const permissions = await getPermissionsForRole(user.role.slug);

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      roleSlug: user.role.slug,
    });

    await issueRefreshCookie(user.id, res);

    const payload: ApiResponse<AuthLoginResponse> = {
      data: {
        accessToken,
        user: toUserPublic(user),
        permissions,
      },
    };
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const cookie = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!cookie) {
      throw new AppError(401, "Refresh token ausente");
    }

    const parsed = parseRefreshCookie(cookie);
    if (!parsed) {
      throw new AppError(401, "Refresh token inválido");
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { id: parsed.id },
      include: {
        user: {
          include: userWithRoleInclude,
        },
      },
    });

    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt < new Date() ||
      stored.tokenHash !== hashToken(parsed.raw)
    ) {
      clearRefreshCookie(res);
      throw new AppError(401, "Refresh token inválido");
    }

    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    await issueRefreshCookie(stored.userId, res);

    const permissions = await getPermissionsForRole(stored.user.role.slug);

    const accessToken = signAccessToken({
      sub: stored.user.id,
      email: stored.user.email,
      roleSlug: stored.user.role.slug,
    });

    const response: ApiResponse<AuthLoginResponse> = {
      data: {
        accessToken,
        user: toUserPublic(stored.user),
        permissions,
      },
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    const cookie = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (cookie) {
      const parsed = parseRefreshCookie(cookie);
      if (parsed) {
        await prisma.refreshToken.updateMany({
          where: { id: parsed.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }

    clearRefreshCookie(res);
    res.json({ data: { ok: true } } satisfies ApiResponse<{ ok: boolean }>);
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const session = await buildAuthSession(req.user!.id);
    res.json({
      data: session,
    } satisfies ApiResponse<AuthSession>);
  } catch (error) {
    next(error);
  }
});

export default router;
