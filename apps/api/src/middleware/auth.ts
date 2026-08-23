import type { NextFunction, Request, Response } from "express";
import type { PermissionKey } from "@horizon/shared";
import { verifyAccessToken } from "../lib/auth";
import { AppError } from "../lib/errors";
import { getPermissionsForRole } from "../lib/permissions";

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
      throw new AppError(401, "Não autenticado");
    }

    const token = header.slice("Bearer ".length).trim();
    const payload = verifyAccessToken(token);
    const permissions = await getPermissionsForRole(payload.roleSlug);

    req.user = {
      id: payload.sub,
      email: payload.email,
      roleSlug: payload.roleSlug,
      permissions,
    };
    next();
  } catch {
    next(new AppError(401, "Token inválido ou expirado"));
  }
}
