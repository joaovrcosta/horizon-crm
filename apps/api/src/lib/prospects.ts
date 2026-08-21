import { ActivityType, Prisma, ProspectStatus } from "@prisma/client";
import { digitsOnly } from "@horizon/shared";
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
  category: string | null;
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

export function serializeProspect(p: ProspectWithAssignee): Prospect {
  return {
    id: p.id,
    name: p.name,
    address: p.address,
    phone: p.phone,
    email: p.email,
    whatsapp: p.whatsapp,
    mapsUrl: p.mapsUrl,
    website: p.website,
    category: p.category,
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
  };
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
      throw new AppError(409, "Já existe um prospect com este telefone", {
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
      throw new AppError(409, "Já existe um prospect com este link do Maps", {
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

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
