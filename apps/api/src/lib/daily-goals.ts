import { ActivityType } from "@prisma/client";
import type { DailyGoalToday } from "@horizon/shared";
import { AppError } from "./errors";
import { endOfDay, startOfDay } from "./prospects";
import { prisma } from "./prisma";

/** Tipos de atividade que contam como tarefa concluída na meta diária. */
export const GOAL_ACTIVITY_TYPES: ActivityType[] = [
  ActivityType.CALL,
  ActivityType.WHATSAPP,
  ActivityType.VISIT,
  ActivityType.EMAIL,
  ActivityType.OTHER,
];

export function isGoalActivityType(type: ActivityType | string) {
  return GOAL_ACTIVITY_TYPES.includes(type as ActivityType);
}

async function countTodayGoalActivities(userId: string, now = new Date()) {
  return prisma.prospectActivity.count({
    where: {
      userId,
      type: { in: GOAL_ACTIVITY_TYPES },
      createdAt: {
        gte: startOfDay(now),
        lte: endOfDay(now),
      },
    },
  });
}

function buildProgress(
  visible: boolean,
  target: number,
  completed: number,
): DailyGoalToday {
  if (!visible || target <= 0) {
    return {
      visible: false,
      target: 0,
      completed: 0,
      remaining: 0,
      reached: false,
    };
  }
  const capped = Math.min(completed, target);
  return {
    visible: true,
    target,
    completed: capped,
    remaining: Math.max(0, target - completed),
    reached: completed >= target,
  };
}

export async function getDailyGoalProgress(
  userId: string,
  now = new Date(),
): Promise<DailyGoalToday> {
  const config = await prisma.dailyGoalConfig.findUnique({
    where: { userId },
  });
  if (!config?.enabled || config.targetCount <= 0) {
    return buildProgress(false, 0, 0);
  }

  const completed = await countTodayGoalActivities(userId, now);
  return buildProgress(true, config.targetCount, completed);
}

/** Após registrar uma atividade elegível, retorna progresso atualizado. */
export async function getDailyGoalProgressAfterActivity(
  userId: string,
  activityType: ActivityType | string,
  now = new Date(),
): Promise<DailyGoalToday | undefined> {
  if (!isGoalActivityType(activityType)) return undefined;
  return getDailyGoalProgress(userId, now);
}

export async function listDailyGoalConfigs() {
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      dailyGoalConfig: true,
    },
  });

  const now = new Date();
  const counts = await Promise.all(
    users.map((user) => countTodayGoalActivities(user.id, now)),
  );

  return users.map((user, index) => ({
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    targetCount: user.dailyGoalConfig?.targetCount ?? 5,
    enabled: user.dailyGoalConfig?.enabled ?? false,
    completedToday: counts[index] ?? 0,
  }));
}

export async function upsertDailyGoalConfig(
  userId: string,
  data: { targetCount: number; enabled: boolean },
  updatedById: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    throw new AppError(404, "Usuário não encontrado");
  }

  return prisma.dailyGoalConfig.upsert({
    where: { userId },
    create: {
      userId,
      targetCount: data.targetCount,
      enabled: data.enabled,
      updatedById,
    },
    update: {
      targetCount: data.targetCount,
      enabled: data.enabled,
      updatedById,
    },
  });
}
