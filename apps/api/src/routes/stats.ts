import { Router } from "express";
import { ProspectStatus } from "@prisma/client";
import type { ApiResponse, ProspectStats, ProspectStatus as SharedStatus } from "@horizon/shared";
import { PROSPECT_STATUSES } from "@horizon/shared";
import { prisma } from "../lib/prisma";
import { endOfToday, startOfMonth, startOfToday } from "../lib/prospects";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/prospects", async (_req, res, next) => {
  try {
    const [grouped, overdueCount, dueTodayCount, wonThisMonth, overdue] =
      await Promise.all([
        prisma.prospect.groupBy({
          by: ["status"],
          _count: { _all: true },
        }),
        prisma.prospect.count({
          where: {
            nextContactAt: { lt: startOfToday() },
            status: { notIn: [ProspectStatus.WON, ProspectStatus.LOST] },
          },
        }),
        prisma.prospect.count({
          where: {
            nextContactAt: { gte: startOfToday(), lte: endOfToday() },
            status: { notIn: [ProspectStatus.WON, ProspectStatus.LOST] },
          },
        }),
        prisma.prospect.count({
          where: {
            status: ProspectStatus.WON,
            updatedAt: { gte: startOfMonth() },
          },
        }),
        prisma.prospect.findMany({
          where: {
            nextContactAt: { lt: startOfToday() },
            status: { notIn: [ProspectStatus.WON, ProspectStatus.LOST] },
          },
          include: { assignee: { select: { name: true } } },
          orderBy: { nextContactAt: "asc" },
          take: 10,
        }),
      ]);

    const byStatus = Object.fromEntries(
      PROSPECT_STATUSES.map((s) => [s, 0]),
    ) as Record<SharedStatus, number>;

    for (const row of grouped) {
      byStatus[row.status as SharedStatus] = row._count._all;
    }

    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

    const payload: ProspectStats = {
      total,
      byStatus,
      overdueCount,
      dueTodayCount,
      wonThisMonth,
      overdue: overdue.map((p) => ({
        id: p.id,
        name: p.name,
        nextContactAt: p.nextContactAt!.toISOString(),
        assigneeName: p.assignee?.name ?? null,
        status: p.status as SharedStatus,
      })),
    };

    res.json({ data: payload } satisfies ApiResponse<ProspectStats>);
  } catch (error) {
    next(error);
  }
});

export default router;
