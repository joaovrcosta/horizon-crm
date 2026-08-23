import type { NextFunction, Request, Response } from "express";
import type { PermissionKey } from "@horizon/shared";
import { verifyAccessToken } from "../lib/auth";
import { AppError } from "../lib/errors";
import { getPermissionsForRole } from "../lib/permissions";
import { prisma } from "../lib/prisma";

export type AuthUser = {
  id: string;
  email: string;
  roleSlug: string;
  permissions: PermissionKey[];
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      next(new AppError(401, "Não autenticado"));
      return;
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      next(new AppError(401, "Não autenticado"));
      return;
    }

    let payload: { sub: string; email: string; roleSlug?: string; role?: string };
    try {
      payload = verifyAccessToken(token) as typeof payload;
    } catch {
      next(new AppError(401, "Token inválido ou expirado"));
      return;
    }

    // Aceita JWT novo (roleSlug) ou legado (role) e, se faltar, busca no banco
    let roleSlug = payload.roleSlug ?? payload.role;
    if (!roleSlug) {
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        include: { role: { select: { slug: true } } },
      });
      if (!user) {
        next(new AppError(401, "Usuário não encontrado"));
        return;
      }
      roleSlug = user.role.slug;
    }

    const permissions = await getPermissionsForRole(roleSlug);

    req.user = {
      id: payload.sub,
      email: payload.email,
      roleSlug,
      permissions,
    };
    next();
  } catch (error) {
    next(error);
  }
}
