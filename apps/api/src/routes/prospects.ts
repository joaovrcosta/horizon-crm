import { Router } from "express";
import { ProspectStatus } from "@prisma/client";
import { z } from "zod";
import { digitsOnly, getCountryFilterValues, normalizeCountryCode, type ApiResponse, type Prospect } from "@horizon/shared";
import { AppError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import {
  assertNoDuplicate,
  emptyToNull,
  endOfToday,
  logStatusChange,
  normalizeUrl,
  serializeProspect,
  startOfToday,
} from "../lib/prospects";
import { requireAuth } from "../middleware/auth";

function parseCountry(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const code = normalizeCountryCode(value);
  if (!code) {
    throw new AppError(400, "País inválido. Selecione um país da lista.");
  }
  return code;
}

const router = Router();

const statusEnum = z.enum([
  "NEW",
  "CONTACTED",
  "NEGOTIATING",
  "WON",
  "LOST",
]);

const dueEnum = z.enum(["overdue", "today", "upcoming"]);

const createSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  whatsapp: z.string().max(50).optional().nullable(),
  mapsUrl: z.string().max(2000).optional().nullable(),
  website: z.string().max(2000).optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  country: z.string().max(120).optional().nullable(),
  languages: z.array(z.string().min(1).max(80)).max(20).optional(),
  status: statusEnum.optional(),
  notes: z.string().max(5000).optional().nullable(),
  lostReason: z.string().max(500).optional().nullable(),
  estimatedValue: z.number().nonnegative().optional().nullable(),
  nextContactAt: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
});

const updateSchema = createSchema.partial();

const includeAssignee = { assignee: { select: { id: true, name: true } } };

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const query = z
      .object({
        status: statusEnum.optional(),
        q: z.string().optional(),
        assigneeId: z.string().cuid().optional(),
        due: dueEnum.optional(),
        country: z.string().optional(),
      })
      .parse(req.query);

    const countryCode = query.country
      ? normalizeCountryCode(query.country)
      : null;
    if (query.country && !countryCode) {
      throw new AppError(400, "País inválido.");
    }

    const dueFilter =
      query.due === "overdue"
        ? { nextContactAt: { lt: startOfToday() }, status: { notIn: [ProspectStatus.WON, ProspectStatus.LOST] } }
        : query.due === "today"
          ? {
              nextContactAt: { gte: startOfToday(), lte: endOfToday() },
              status: { notIn: [ProspectStatus.WON, ProspectStatus.LOST] },
            }
          : query.due === "upcoming"
            ? {
                nextContactAt: { gt: endOfToday() },
                status: { notIn: [ProspectStatus.WON, ProspectStatus.LOST] },
              }
            : {};

    const prospects = await prisma.prospect.findMany({
      where: {
        ...(query.status ? { status: query.status as ProspectStatus } : {}),
        ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
        ...(countryCode
          ? {
              country: {
                in: getCountryFilterValues(countryCode),
                mode: "insensitive",
              },
            }
          : {}),
        ...dueFilter,
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: "insensitive" } },
                { address: { contains: query.q, mode: "insensitive" } },
                { category: { contains: query.q, mode: "insensitive" } },
                { phone: { contains: query.q, mode: "insensitive" } },
                { email: { contains: query.q, mode: "insensitive" } },
                { whatsapp: { contains: query.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: includeAssignee,
      orderBy: [{ nextContactAt: "asc" }, { updatedAt: "desc" }],
    });

    res.json({
      data: prospects.map(serializeProspect),
    } satisfies ApiResponse<Prospect[]>);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = z.string().cuid().parse(req.params.id);
    const prospect = await prisma.prospect.findUnique({
      where: { id },
      include: includeAssignee,
    });
    if (!prospect) {
      throw new AppError(404, "Prospect não encontrado");
    }
    res.json({
      data: serializeProspect(prospect),
    } satisfies ApiResponse<Prospect>);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const phone = emptyToNull(body.phone);
    const mapsUrl = normalizeUrl(body.mapsUrl);
    const email = emptyToNull(body.email);
    const whatsapp = emptyToNull(body.whatsapp);
    const assigneeId = emptyToNull(body.assigneeId) ?? req.user!.id;

    await assertNoDuplicate({ phone, mapsUrl });

    if (assigneeId) {
      const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
      if (!assignee) throw new AppError(400, "Responsável inválido");
    }

    const status = (body.status as ProspectStatus | undefined) ?? ProspectStatus.NEW;

    const prospect = await prisma.prospect.create({
      data: {
        name: body.name,
        address: emptyToNull(body.address),
        phone,
        phoneDigits: digitsOnly(phone),
        email,
        whatsapp,
        mapsUrl,
        website: normalizeUrl(body.website),
        category: emptyToNull(body.category),
        country: parseCountry(body.country),
        languages: (body.languages ?? [])
          .map((l) => l.trim())
          .filter(Boolean),
        status,
        notes: emptyToNull(body.notes),
        lostReason:
          status === ProspectStatus.LOST ? emptyToNull(body.lostReason) : null,
        estimatedValue:
          body.estimatedValue === undefined || body.estimatedValue === null
            ? null
            : body.estimatedValue,
        nextContactAt: emptyToNull(body.nextContactAt)
          ? new Date(body.nextContactAt as string)
          : null,
        assigneeId,
        createdById: req.user!.id,
      },
      include: includeAssignee,
    });

    await prisma.prospectActivity.create({
      data: {
        prospectId: prospect.id,
        userId: req.user!.id,
        type: "NOTE",
        content: "Prospect criado",
      },
    });

    res.status(201).json({
      data: serializeProspect(prospect),
    } satisfies ApiResponse<Prospect>);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const id = z.string().cuid().parse(req.params.id);
    const body = updateSchema.parse(req.body);

    const existing = await prisma.prospect.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, "Prospect não encontrado");
    }

    const nextPhone =
      body.phone !== undefined ? emptyToNull(body.phone) : existing.phone;
    const nextMaps =
      body.mapsUrl !== undefined ? normalizeUrl(body.mapsUrl) : existing.mapsUrl;

    if (body.phone !== undefined || body.mapsUrl !== undefined) {
      await assertNoDuplicate({
        phone: nextPhone,
        mapsUrl: nextMaps,
        excludeId: id,
      });
    }

    if (body.assigneeId !== undefined && body.assigneeId) {
      const assignee = await prisma.user.findUnique({
        where: { id: body.assigneeId },
      });
      if (!assignee) throw new AppError(400, "Responsável inválido");
    }

    const nextStatus =
      body.status !== undefined
        ? (body.status as ProspectStatus)
        : existing.status;

    const prospect = await prisma.prospect.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.address !== undefined
          ? { address: emptyToNull(body.address) }
          : {}),
        ...(body.phone !== undefined
          ? { phone: nextPhone, phoneDigits: digitsOnly(nextPhone) }
          : {}),
        ...(body.email !== undefined ? { email: emptyToNull(body.email) } : {}),
        ...(body.whatsapp !== undefined
          ? { whatsapp: emptyToNull(body.whatsapp) }
          : {}),
        ...(body.mapsUrl !== undefined ? { mapsUrl: nextMaps } : {}),
        ...(body.website !== undefined
          ? { website: normalizeUrl(body.website) }
          : {}),
        ...(body.category !== undefined
          ? { category: emptyToNull(body.category) }
          : {}),
        ...(body.country !== undefined
          ? { country: parseCountry(body.country) }
          : {}),
        ...(body.languages !== undefined
          ? {
              languages: body.languages
                .map((l) => l.trim())
                .filter(Boolean),
            }
          : {}),
        ...(body.status !== undefined ? { status: nextStatus } : {}),
        ...(body.notes !== undefined ? { notes: emptyToNull(body.notes) } : {}),
        ...(body.lostReason !== undefined
          ? { lostReason: emptyToNull(body.lostReason) }
          : {}),
        ...(body.estimatedValue !== undefined
          ? {
              estimatedValue:
                body.estimatedValue === null ? null : body.estimatedValue,
            }
          : {}),
        ...(body.nextContactAt !== undefined
          ? {
              nextContactAt: emptyToNull(body.nextContactAt)
                ? new Date(body.nextContactAt as string)
                : null,
            }
          : {}),
        ...(body.assigneeId !== undefined
          ? { assigneeId: emptyToNull(body.assigneeId) }
          : {}),
        ...(nextStatus !== ProspectStatus.LOST && body.status !== undefined
          ? { lostReason: null }
          : {}),
      },
      include: includeAssignee,
    });

    if (body.status !== undefined) {
      await logStatusChange({
        prospectId: id,
        userId: req.user!.id,
        from: existing.status,
        to: nextStatus,
      });
    }

    res.json({
      data: serializeProspect(prospect),
    } satisfies ApiResponse<Prospect>);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = z.string().cuid().parse(req.params.id);
    await prisma.prospect.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
