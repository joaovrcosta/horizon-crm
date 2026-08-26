import { ActivityType, Prisma, ProspectStatus, SiteQuality } from "@prisma/client";
import { digitsOnly, normalizeCountryCode } from "@horizon/shared";
import type { Prospect } from "@horizon/shared";
import { AppError } from "./errors";
import { prisma } from "./prisma";

const STATUS_LABEL: Record<ProspectStatus, string> = {
  NEW: "Novo",
  CONTACTED: "Contactado",
  NEGOTIATING: "Negociando",
  WON: "Ganho",
  LOST: "Perdido",
};

export type ProspectWithAssignee = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  mapsUrl: string | null;
  website: string | null;
  siteQuality: SiteQuality | null;
  category: string | null;
  country: string | null;
  languages: string[];
  status: ProspectStatus;
  notes: string | null;
  lostReason: string | null;
  estimatedValue: Prisma.Decimal | null;
  nextContactAt: Date | null;
  assigneeId: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  assignee?: { id: string; name: string } | null;
};

export function serializeProspect(
  p: ProspectWithAssignee,
  favorited = false,
): Prospect {
  return {
    id: p.id,
    name: p.name,
    address: p.address,
    phone: p.phone,
    email: p.email,
    whatsapp: p.whatsapp,
    mapsUrl: p.mapsUrl,
    website: p.website,
    siteQuality: p.siteQuality,
    category: p.category,
    country: normalizeCountryCode(p.country),
    languages: p.languages ?? [],
    status: p.status,
    notes: p.notes,
    lostReason: p.lostReason,
    estimatedValue: p.estimatedValue ? Number(p.estimatedValue) : null,
    nextContactAt: p.nextContactAt?.toISOString() ?? null,
    assigneeId: p.assigneeId,
    assigneeName: p.assignee?.name ?? null,
    createdById: p.createdById,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    favorited,
  };
}

export async function favoritedProspectIds(
  userId: string,
  prospectIds: string[],
) {
  if (prospectIds.length === 0) return new Set<string>();
  const rows = await prisma.prospectFavorite.findMany({
    where: { userId, prospectId: { in: prospectIds } },
    select: { prospectId: true },
  });
  return new Set(rows.map((row) => row.prospectId));
}

export async function isProspectFavorited(userId: string, prospectId: string) {
  const row = await prisma.prospectFavorite.findUnique({
    where: { userId_prospectId: { userId, prospectId } },
    select: { userId: true },
  });
  return Boolean(row);
}

export async function assertNoDuplicate(params: {
  phone?: string | null;
  mapsUrl?: string | null;
  excludeId?: string;
}) {
  const phoneDigits = digitsOnly(params.phone);
  const mapsUrl = params.mapsUrl?.trim() || null;

  if (phoneDigits) {
    const conflict = await prisma.prospect.findFirst({
      where: {
        phoneDigits,
        ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
      },
      select: { id: true, name: true },
    });
    if (conflict) {
      throw new AppError(409, "Já existe um cliente com este telefone", {
        conflictId: conflict.id,
        conflictName: conflict.name,
        field: "phone",
      });
    }
  }

  if (mapsUrl) {
    const conflict = await prisma.prospect.findFirst({
      where: {
        mapsUrl,
        ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
      },
      select: { id: true, name: true },
    });
    if (conflict) {
      throw new AppError(409, "Já existe um cliente com este link do Maps", {
        conflictId: conflict.id,
        conflictName: conflict.name,
        field: "mapsUrl",
      });
    }
  }
}

export async function logStatusChange(params: {
  prospectId: string;
  userId: string;
  from: ProspectStatus;
  to: ProspectStatus;
}) {
  if (params.from === params.to) return;
  await prisma.prospectActivity.create({
    data: {
      prospectId: params.prospectId,
      userId: params.userId,
      type: ActivityType.STATUS_CHANGE,
      content: `Status: ${STATUS_LABEL[params.from]} → ${STATUS_LABEL[params.to]}`,
    },
  });
}

export function emptyToNull(value?: string | null) {
  if (value === "" || value === undefined) return null;
  return value;
}

export function normalizeUrl(value?: string | null) {
  const normalized = emptyToNull(value);
  if (!normalized) return null;
  if (!/^https?:\/\//i.test(normalized)) {
    throw new AppError(400, "URL deve começar com http:// ou https://");
  }
  return normalized;
}

/** Site do cliente — opcional; aceita domínio sem protocolo. */
export function normalizeWebsiteUrl(value?: string | null) {
  const normalized = emptyToNull(value?.trim());
  if (!normalized) return null;
  if (!/^https?:\/\//i.test(normalized)) {
    return `https://${normalized}`;
  }
  return normalized;
}

/** Fuso oficial do produto (Brasília). Evita virar o dia às 21h no Brasil quando o servidor roda em UTC. */
export const APP_TIMEZONE = "America/Sao_Paulo";

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getZonedParts(date: Date, timeZone = APP_TIMEZONE): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  const hour = Number(map.hour);
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: hour === 24 ? 0 : hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** Converte horário de parede em `timeZone` para um Instant UTC. */
function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
  timeZone = APP_TIMEZONE,
) {
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  let utcMs = desiredAsUtc;

  for (let i = 0; i < 3; i++) {
    const parts = getZonedParts(new Date(utcMs), timeZone);
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      ms,
    );
    utcMs += desiredAsUtc - asUtc;
  }

  return new Date(utcMs);
}

export function startOfToday() {
  const parts = getZonedParts(new Date());
  return zonedDateTimeToUtc(parts.year, parts.month, parts.day, 0, 0, 0, 0);
}

export function endOfToday() {
  const parts = getZonedParts(new Date());
  return zonedDateTimeToUtc(parts.year, parts.month, parts.day, 23, 59, 59, 999);
}

export function startOfMonth() {
  const parts = getZonedParts(new Date());
  return zonedDateTimeToUtc(parts.year, parts.month, 1, 0, 0, 0, 0);
}

export function startOfLastMonth() {
  const parts = getZonedParts(new Date());
  let year = parts.year;
  let month = parts.month - 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return zonedDateTimeToUtc(year, month, 1, 0, 0, 0, 0);
}

export function endOfDay(date: Date) {
  const parts = getZonedParts(date);
  return zonedDateTimeToUtc(parts.year, parts.month, parts.day, 23, 59, 59, 999);
}

export function startOfDay(date: Date) {
  const parts = getZonedParts(date);
  return zonedDateTimeToUtc(parts.year, parts.month, parts.day, 0, 0, 0, 0);
}

export function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new AppError(400, "Data inválida. Use o formato AAAA-MM-DD.");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = zonedDateTimeToUtc(year, month, day, 12, 0, 0, 0);
  const parts = getZonedParts(parsed);
  if (parts.year !== year || parts.month !== month || parts.day !== day) {
    throw new AppError(400, "Data inválida.");
  }
  return parsed;
}

export type StatsPeriodRange = {
  days: number | null;
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  compareLabel: string;
};

const STATS_PRESET_DAYS = [1, 7, 14, 30] as const;

export function resolveStatsPeriod(params: {
  days?: number;
  from?: string;
  to?: string;
}): StatsPeriodRange {
  let from: Date;
  let to: Date;
  let days: number | null;

  if (params.from || params.to) {
    if (!params.from || !params.to) {
      throw new AppError(400, "Informe data inicial e final.");
    }
    from = startOfDay(parseDateOnly(params.from));
    to = endOfDay(parseDateOnly(params.to));
    days = null;
  } else {
    const preset = STATS_PRESET_DAYS.includes(
      params.days as (typeof STATS_PRESET_DAYS)[number],
    )
      ? (params.days as (typeof STATS_PRESET_DAYS)[number])
      : 7;
    days = preset;
    to = endOfToday();
    from = daysAgo(preset - 1);
  }

  if (from.getTime() > to.getTime()) {
    throw new AppError(400, "A data inicial deve ser anterior à final.");
  }

  const durationMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);

  const compareLabel = days
    ? days === 1
      ? "ontem"
      : `dos ${days} dias anteriores`
    : "do período anterior";

  return { days, from, to, prevFrom, prevTo, compareLabel };
}

export function daysAgo(days: number) {
  const start = startOfToday();
  return startOfDay(new Date(start.getTime() - days * 24 * 60 * 60 * 1000));
}

export function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}
