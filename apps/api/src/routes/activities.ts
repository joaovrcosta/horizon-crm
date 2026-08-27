import { Router } from "express";
import { ActivityType } from "@prisma/client";
import { z } from "zod";
import type { ApiResponse, ProspectActivity } from "@horizon/shared";
import { AppError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router({ mergeParams: true });

const typeEnum = z.enum([
  "NOTE",
  "CALL",
  "WHATSAPP",
  "VISIT",
  "EMAIL",
  "STATUS_CHANGE",
  "OTHER",
]);

const createSchema = z.object({
  type: typeEnum.default("NOTE"),
  content: z.string().min(1).max(5000),
});

function serialize(activity: {
  id: string;
  prospectId: string;
  userId: string;
  type: ActivityType;
  content: string;
  createdAt: Date;
  user: { name: string };
}): ProspectActivity {
  return {
    id: activity.id,
    prospectId: activity.prospectId,
    userId: activity.userId,
    userName: activity.user.name,
    type: activity.type,
    content: activity.content,
    createdAt: activity.createdAt.toISOString(),
  };
}

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const prospectId = z
      .string()
      .cuid()
      .parse((req.params as { id?: string }).id);
    const prospect = await prisma.prospect.findUnique({
      where: { id: prospectId },
      select: { id: true },
    });
    if (!prospect) {
      throw new AppError(404, "Prospect não encontrado");
    }

    const activities = await prisma.prospectActivity.findMany({
      where: { prospectId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      data: activities.map(serialize),
    } satisfies ApiResponse<ProspectActivity[]>);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const prospectId = z
      .string()
      .cuid()
      .parse((req.params as { id?: string }).id);
    const body = createSchema.parse(req.body);

    if (body.type === "STATUS_CHANGE") {
      throw new AppError(400, "STATUS_CHANGE é automático");
    }

    const prospect = await prisma.prospect.findUnique({
      where: { id: prospectId },
      select: { id: true },
    });
    if (!prospect) {
      throw new AppError(404, "Prospect não encontrado");
    }

    const activity = await prisma.prospectActivity.create({
      data: {
        prospectId,
        userId: req.user!.id,
        type: body.type as ActivityType,
        content: body.content,
      },
      include: { user: { select: { name: true } } },
    });

    res.status(201).json({
      data: serialize(activity),
    } satisfies ApiResponse<ProspectActivity>);
  } catch (error) {
    next(error);
  }
});

export default router;
