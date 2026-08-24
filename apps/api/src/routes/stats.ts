import { Router } from "express";
import { ProspectStatus } from "@prisma/client";
import { z } from "zod";
import type {
  ApiResponse,
  ProspectStats,
  ProspectStatus as SharedStatus,
} from "@horizon/shared";
import { PROSPECT_STATUSES } from "@horizon/shared";
import { AppError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import {
  endOfToday,
  percentChange,
  resolveStatsPeriod,
  startOfDay,
  startOfToday,
} from "../lib/prospects";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

const openStatusFilter = {
  notIn: [ProspectStatus.WON, ProspectStatus.LOST] as ProspectStatus[],
};

const querySchema = z
  .object({
    days: z.coerce.number().int().optional(),
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .refine(
    (value) => !(value.from || value.to) || (value.from && value.to),
    { message: "Informe data inicial e final." },
  );

function createdInRange(from: Date, to: Date) {
  return { createdAt: { gte: from, lte: to } };
}

function wonInRange(from: Date, to: Date) {
  return {
    status: ProspectStatus.WON,
    updatedAt: { gte: from, lte: to },
  };
}

function overdueBefore(from: Date, to: Date, before: Date) {
  const end = new Date(Math.min(to.getTime(), before.getTime() - 1));
  if (end.getTime() < from.getTime()) {
    return { id: { in: [] } };
  }
  return {
    nextContactAt: { gte: from, lte: end },
    status: openStatusFilter,
  };
}

function dueOnDay(dayStart: Date, dayEnd: Date) {
  return {
    nextContactAt: { gte: dayStart, lte: dayEnd },
    status: openStatusFilter,
  };
}

function periodIncludesToday(from: Date, to: Date) {
  const todayStart = startOfToday();
  const todayEnd = endOfToday();
  return from.getTime() <= todayStart.getTime() && to.getTime() >= todayEnd.getTime();
}

router.get("/prospects", async (req, res, next) => {
  try {
    const query = querySchema.parse(req.query);
    const period = resolveStatsPeriod({
      days: query.days,
      from: query.from,
      to: query.to,
    });
    const { from, to, prevFrom, prevTo } = period;
    const todayStart = startOfToday();
    const todayEnd = endOfToday();
    const includesToday = periodIncludesToday(from, to);

    const [
      grouped,
      total,
      totalPrev,
      overdueCount,
      overduePrev,
      dueTodayCount,
      dueTodayPrev,
      wonInPeriod,
      wonPrevPeriod,
      overdue,
    ] = await Promise.all([
      prisma.prospect.groupBy({
        by: ["status"],
        where: createdInRange(from, to),
        _count: { _all: true },
      }),
      prisma.prospect.count({ where: createdInRange(from, to) }),
      prisma.prospect.count({ where: createdInRange(prevFrom, prevTo) }),
      prisma.prospect.count({
        where: overdueBefore(from, to, todayStart),
      }),
      prisma.prospect.count({
        where: overdueBefore(prevFrom, prevTo, prevTo),
      }),
      includesToday
        ? prisma.prospect.count({ where: dueOnDay(todayStart, todayEnd) })
        : Promise.resolve(0),
      includesToday
        ? prisma.prospect.count({
            where: dueOnDay(startOfDay(prevTo), prevTo),
          })
        : Promise.resolve(0),
      prisma.prospect.count({ where: wonInRange(from, to) }),
      prisma.prospect.count({ where: wonInRange(prevFrom, prevTo) }),
      prisma.prospect.findMany({
        where: overdueBefore(from, to, todayStart),
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

    const payload: ProspectStats = {
      total,
      byStatus,
      overdueCount,
      dueTodayCount,
      wonThisMonth: wonInPeriod,
      period: {
        days: period.days,
        from: from.toISOString(),
        to: to.toISOString(),
        compareLabel: period.compareLabel,
      },
      trends: {
        total: {
          delta: total - totalPrev,
          percent: percentChange(total, totalPrev),
        },
        overdue: {
          delta: overdueCount - overduePrev,
          percent: percentChange(overdueCount, overduePrev),
        },
        dueToday: {
          delta: dueTodayCount - dueTodayPrev,
          percent: percentChange(dueTodayCount, dueTodayPrev),
        },
        wonThisMonth: {
          delta: wonInPeriod - wonPrevPeriod,
          percent: percentChange(wonInPeriod, wonPrevPeriod),
        },
      },
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
    if (error instanceof z.ZodError) {
      next(new AppError(400, error.issues[0]?.message ?? "Parâmetros inválidos"));
      return;
    }
    next(error);
  }
});

export default router;
