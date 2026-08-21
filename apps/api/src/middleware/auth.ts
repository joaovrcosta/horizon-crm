import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { verifyAccessToken } from "../lib/auth";
import { AppError } from "../lib/errors";

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError(401, "Não autenticado");
    }

    const token = header.slice("Bearer ".length).trim();
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch {
    next(new AppError(401, "Token inválido ou expirado"));
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    next(new AppError(401, "Não autenticado"));
    return;
  }
  if (req.user.role !== "ADMIN") {
    next(new AppError(403, "Acesso restrito a administradores"));
    return;
  }
  next();
}
