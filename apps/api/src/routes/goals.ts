import { Router } from "express";
import { z } from "zod";
import type { ApiResponse, DailyGoalConfigUser, DailyGoalToday } from "@horizon/shared";
import { AppError } from "../lib/errors";
import {
  getDailyGoalProgress,
  listDailyGoalConfigs,
  upsertDailyGoalConfig,
} from "../lib/daily-goals";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";

const router = Router();

router.use(requireAuth);

/** GET /goals/me/today — progresso da meta diária do usuário logado */
router.get("/me/today", async (req, res, next) => {
  try {
    const progress = await getDailyGoalProgress(req.user!.id);
    res.json({
      data: progress,
    } satisfies ApiResponse<DailyGoalToday>);
  } catch (error) {
    next(error);
  }
});

/** GET /goals/configs — lista configs de todos os usuários (admin) */
router.get(
  "/configs",
  requirePermission("goals:manage"),
  async (_req, res, next) => {
    try {
      const configs = await listDailyGoalConfigs();
      res.json({
        data: configs,
      } satisfies ApiResponse<DailyGoalConfigUser[]>);
    } catch (error) {
      next(error);
    }
  },
);

const upsertSchema = z.object({
  targetCount: z
    .number()
    .int("A meta deve ser um número inteiro.")
    .min(1, "A meta deve ser pelo menos 1.")
    .max(100, "A meta deve ser no máximo 100."),
  enabled: z.boolean(),
});

/** PUT /goals/users/:userId — define meta e visibilidade por usuário (admin) */
router.put(
  "/users/:userId",
  requirePermission("goals:manage"),
  async (req, res, next) => {
    try {
      const userId = z.string().cuid().parse(req.params.userId);
      const body = upsertSchema.parse(req.body);

      await upsertDailyGoalConfig(
          userId,
          {
            targetCount: body.targetCount,
            enabled: body.enabled,
          },
          req.user!.id,
        );

      const configs = await listDailyGoalConfigs();
      const updated = configs.find((item) => item.userId === userId);
      if (!updated) {
        throw new AppError(404, "Usuário não encontrado");
      }

      res.json({
        data: updated,
      } satisfies ApiResponse<DailyGoalConfigUser>);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
