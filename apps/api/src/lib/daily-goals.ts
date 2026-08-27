import type { DailyGoalToday } from "@horizon/shared";
import { AppError } from "./errors";
import { endOfToday, startOfToday } from "./prospects";
import { prisma } from "./prisma";

const PROSPECT_CREATED_NOTE = "Prospect criado";

function todayRange(now = new Date()) {
  return {
    gte: startOfToday(),
    lte: endOfToday(),
  };
}

/**
 * Conta cadastros de cliente feitos hoje pelo usuário.
 * Inclui retroativamente os já existentes no dia (Brasília), cruzando:
 * - clientes que o usuário criou (`createdById`)
 * - clientes em que é responsável (`assigneeId`)
 * - atividades "Prospect criado" registradas hoje pelo usuário
 */
async function countTodayProspectCreations(userId: string, now = new Date()) {
  const createdAt = todayRange(now);

  const [createdProspects, assignedProspects, createdActivities] =
    await Promise.all([
      prisma.prospect.findMany({
        where: { createdById: userId, createdAt },
        select: { id: true },
      }),
      prisma.prospect.findMany({
        where: { assigneeId: userId, createdAt },
        select: { id: true },
      }),
      prisma.prospectActivity.findMany({
        where: {
          userId,
          type: "NOTE",
          content: PROSPECT_CREATED_NOTE,
          createdAt,
        },
        select: { prospectId: true },
      }),
    ]);

  const uniqueProspectIds = new Set<string>();
  for (const row of createdProspects) uniqueProspectIds.add(row.id);
  for (const row of assignedProspects) uniqueProspectIds.add(row.id);
  for (const row of createdActivities) uniqueProspectIds.add(row.prospectId);

  return uniqueProspectIds.size;
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
  return {
    visible: true,
    target,
    completed: Math.min(completed, target),
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

  const completed = await countTodayProspectCreations(userId, now);
  return buildProgress(true, config.targetCount, completed);
}

/** Após cadastrar um cliente, retorna progresso atualizado. */
export async function getDailyGoalProgressAfterProspectCreated(
  userId: string,
  now = new Date(),
): Promise<DailyGoalToday> {
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
    users.map((user) => countTodayProspectCreations(user.id, now)),
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
