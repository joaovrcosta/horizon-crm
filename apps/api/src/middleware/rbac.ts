import type { NextFunction, Request, Response } from "express";
import type { PermissionKey } from "@horizon/shared";
import { AppError } from "../lib/errors";

export function requirePermission(...keys: PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, "Não autenticado"));
      return;
    }

    const allowed = keys.some((key) => req.user!.permissions.includes(key));
    if (!allowed) {
      next(new AppError(403, "Permissão insuficiente"));
      return;
    }

    next();
  };
}
