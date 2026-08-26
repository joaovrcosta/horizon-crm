import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { ApiResponse, EmailSignature, MailboxItem, MailboxPage, SentEmail } from "@horizon/shared";
import { DEFAULT_EMAIL_REPLY_TO } from "@horizon/shared";
import { AppError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import {
  renderProspectEmailHtml,
  resolveReplyToEmail,
  sendProspectEmail,
} from "../lib/resend";
import { requireAuth } from "../middleware/auth";

const router = Router();

const sendSchema = z.object({
  to: z.string().email().max(320),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(50000),
  fontFamily: z.string().max(120).optional().nullable(),
  includeSignature: z.boolean().optional().default(true),
});

const PAGE_SIZE_DEFAULT = 50;

const listSchema = z.object({
  q: z.string().trim().max(200).optional(),
  folder: z.enum(["all", "sent", "received"]).optional().default("all"),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z
    .coerce.number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(PAGE_SIZE_DEFAULT),
});

function serializeSignature(row: {
  id: string;
  userId: string;
  enabled: boolean;
  replyToEmail: string | null;
  displayName: string | null;
  title: string | null;
  phone: string | null;
  logoUrl: string | null;
  company: string | null;
  tagline: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  website: string | null;
  defaultIntro: string | null;
  updatedAt: Date;
} | null): EmailSignature | null {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    enabled: row.enabled,
    replyToEmail: row.replyToEmail ?? DEFAULT_EMAIL_REPLY_TO,
    displayName: row.displayName,
    title: row.title,
    phone: row.phone,
    logoUrl: row.logoUrl,
    company: row.company,
    tagline: row.tagline,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    website: row.website,
    defaultIntro: row.defaultIntro,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeSentEmail(row: {
  id: string;
  userId: string;
  prospectId: string | null;
  toEmail: string;
  toName: string | null;
  subject: string;
  body: string;
  replyTo: string | null;
  providerId: string | null;
  deliveryStatus: SentEmail["deliveryStatus"];
  deliveredAt: Date | null;
  createdAt: Date;
  user: { name: string };
  prospect: { name: string } | null;
}): SentEmail {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.user.name,
    prospectId: row.prospectId,
    prospectName: row.prospect?.name ?? row.toName,
    toEmail: row.toEmail,
    toName: row.toName,
    subject: row.subject,
    body: row.body,
    replyTo: row.replyTo,
    providerId: row.providerId,
    deliveryStatus: row.deliveryStatus,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

const sentInclude = {
  user: { select: { name: true } },
  prospect: { select: { name: true } },
} as const;

const receivedInclude = {
  user: { select: { name: true } },
  prospect: { select: { name: true } },
} as const;

function mailboxId(direction: "sent" | "received", id: string) {
  return `${direction}:${id}`;
}

function parseMailboxId(value: string): { direction: "sent" | "received"; id: string } | null {
  const match = value.match(/^(sent|received):(.+)$/);
  if (!match) return null;
  return { direction: match[1] as "sent" | "received", id: match[2]! };
}

function serializeMailboxFromSent(row: {
  id: string;
  userId: string;
  prospectId: string | null;
  toEmail: string;
  toName: string | null;
  subject: string;
  body: string;
  replyTo: string | null;
  providerId: string | null;
  deliveryStatus: NonNullable<MailboxItem["deliveryStatus"]>;
  deliveredAt: Date | null;
  createdAt: Date;
  user: { name: string };
  prospect: { name: string } | null;
}): MailboxItem {
  return {
    id: mailboxId("sent", row.id),
    direction: "sent",
    isReply: false,
    unread: false,
    userId: row.userId,
    userName: row.user.name,
    prospectId: row.prospectId,
    prospectName: row.prospect?.name ?? row.toName,
    fromEmail: row.replyTo ?? "",
    fromName: row.user.name,
    toEmail: row.toEmail,
    toName: row.toName,
    subject: row.subject,
    body: row.body,
    replyTo: row.replyTo,
    providerId: row.providerId,
    deliveryStatus: row.deliveryStatus,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeMailboxFromReceived(row: {
  id: string;
  userId: string | null;
  prospectId: string | null;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  subject: string;
  body: string;
  isReply: boolean;
  readAt: Date | null;
  providerId: string;
  createdAt: Date;
  user: { name: string } | null;
  prospect: { name: string } | null;
}): MailboxItem {
  return {
    id: mailboxId("received", row.id),
    direction: "received",
    isReply: row.isReply,
    unread: !row.readAt,
    userId: row.userId,
    userName: row.user?.name ?? null,
    prospectId: row.prospectId,
    prospectName: row.prospect?.name ?? row.fromName,
    fromEmail: row.fromEmail,
    fromName: row.fromName,
    toEmail: row.toEmail,
    toName: null,
    subject: row.subject,
    body: row.body,
    replyTo: row.toEmail,
    providerId: row.providerId,
    deliveryStatus: null,
    deliveredAt: null,
    createdAt: row.createdAt.toISOString(),
  };
}

function isMissingMailboxTable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

function parseLegacyEmailActivity(content: string): {
  toEmail: string | null;
  subject: string;
  body: string;
  replyTo: string | null;
  providerId: string | null;
} {
  const lines = content.split(/\r?\n/);
  let toEmail: string | null = null;
  let subject = "(sem assunto)";
  let replyTo: string | null = null;
  let providerId: string | null = null;
  let bodyStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const toMatch = line.match(/para\s+(\S+@\S+)/i);
    if (toMatch) toEmail = toMatch[1]!.replace(/[>,]+$/, "").toLowerCase();
    const subjectMatch = line.match(/^Assunto:\s*(.+)$/i);
    if (subjectMatch) subject = subjectMatch[1]!.trim() || subject;
    const replyMatch = line.match(/^Reply-To:\s*(.+)$/i);
    if (replyMatch) replyTo = replyMatch[1]!.trim();
    const idMatch = line.match(/^ID:\s*(.+)$/i);
    if (idMatch) providerId = idMatch[1]!.trim();
    if (line.trim() === "" && i > 0) {
      bodyStart = i + 1;
      break;
    }
  }

  const body = lines.slice(bodyStart).join("\n").trim();
  return { toEmail, subject, body, replyTo, providerId };
}

/** Importa atividades EMAIL antigas para SentEmail (idempotente). */
async function backfillFromActivities(userId: string) {
  const activities = await prisma.prospectActivity.findMany({
    where: { type: "EMAIL", userId },
    include: {
      prospect: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  for (const activity of activities) {
    const parsed = parseLegacyEmailActivity(activity.content);
    const toEmail =
      parsed.toEmail ??
      activity.prospect.email?.trim().toLowerCase() ??
      null;
    if (!toEmail) continue;

    if (parsed.providerId) {
      const existing = await prisma.sentEmail.findFirst({
        where: { providerId: parsed.providerId },
        select: { id: true },
      });
      if (existing) continue;
    } else {
      const existing = await prisma.sentEmail.findFirst({
        where: {
          userId,
          toEmail,
          subject: parsed.subject,
          createdAt: activity.createdAt,
        },
        select: { id: true },
      });
      if (existing) continue;
    }

    await prisma.sentEmail.create({
      data: {
        userId: activity.userId,
        prospectId: activity.prospectId,
        toEmail,
        toName: activity.prospect.name,
        subject: parsed.subject,
        body: parsed.body || activity.content,
        replyTo: parsed.replyTo,
        providerId: parsed.providerId,
        createdAt: activity.createdAt,
      },
    });
  }
}

router.use(requireAuth);

/** GET /emails — lista enviados e respostas recebidas */
router.get("/", async (req, res, next) => {
  try {
    const query = listSchema.parse(req.query);
    const userId = req.user!.id;

    await backfillFromActivities(userId).catch(() => {
      // não bloqueia a listagem se o backfill falhar
    });

    const q = query.q?.trim();
    const sentWhere = q
      ? {
          OR: [
            { toEmail: { contains: q, mode: "insensitive" as const } },
            { toName: { contains: q, mode: "insensitive" as const } },
            { subject: { contains: q, mode: "insensitive" as const } },
            { body: { contains: q, mode: "insensitive" as const } },
            {
              prospect: {
                name: { contains: q, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {};
    const receivedWhere = q
      ? {
          OR: [
            { fromEmail: { contains: q, mode: "insensitive" as const } },
            { fromName: { contains: q, mode: "insensitive" as const } },
            { toEmail: { contains: q, mode: "insensitive" as const } },
            { subject: { contains: q, mode: "insensitive" as const } },
            { body: { contains: q, mode: "insensitive" as const } },
            {
              prospect: {
                name: { contains: q, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {};

    const includeSent = query.folder !== "received";
    const includeReceived = query.folder !== "sent";

    const [sentMeta, receivedMeta, unreadCount] = await Promise.all([
      includeSent
        ? prisma.sentEmail.findMany({
            where: sentWhere,
            select: { id: true, createdAt: true },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      includeReceived
        ? prisma.receivedEmail
            .findMany({
              where: receivedWhere,
              select: { id: true, createdAt: true },
              orderBy: { createdAt: "desc" },
            })
            .catch((error) => {
              if (isMissingMailboxTable(error)) return [];
              throw error;
            })
        : Promise.resolve([]),
      prisma.receivedEmail
        .count({ where: { readAt: null } })
        .catch((error) => {
          if (isMissingMailboxTable(error)) return 0;
          throw error;
        }),
    ]);

    const merged = [
      ...sentMeta.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        direction: "sent" as const,
      })),
      ...receivedMeta.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        direction: "received" as const,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = merged.length;
    const offset = (query.page - 1) * query.pageSize;
    const pageSlice = merged.slice(offset, offset + query.pageSize);
    const sentIds = pageSlice
      .filter((item) => item.direction === "sent")
      .map((item) => item.id);
    const receivedIds = pageSlice
      .filter((item) => item.direction === "received")
      .map((item) => item.id);

    const [sentRows, receivedRows] = await Promise.all([
      sentIds.length
        ? prisma.sentEmail.findMany({
            where: { id: { in: sentIds } },
            include: sentInclude,
          })
        : Promise.resolve([]),
      receivedIds.length
        ? prisma.receivedEmail.findMany({
            where: { id: { in: receivedIds } },
            include: receivedInclude,
          })
        : Promise.resolve([]),
    ]);

    const sentById = new Map(
      sentRows.map((row) => [row.id, serializeMailboxFromSent(row)]),
    );
    const receivedById = new Map(
      receivedRows.map((row) => [row.id, serializeMailboxFromReceived(row)]),
    );

    const items = pageSlice
      .map((item) =>
        item.direction === "sent"
          ? sentById.get(item.id)
          : receivedById.get(item.id),
      )
      .filter((item): item is MailboxItem => Boolean(item));

    res.json({
      data: {
        items,
        total,
        page: query.page,
        pageSize: query.pageSize,
        unreadCount,
      },
    } satisfies ApiResponse<MailboxPage>);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, error.issues[0]?.message ?? "Parâmetros inválidos"));
      return;
    }
    if (isMissingMailboxTable(error)) {
      console.error("Tabela de e-mails ausente. Rode prisma migrate deploy.");
      res.json({
        data: {
          items: [],
          total: 0,
          page: 1,
          pageSize: PAGE_SIZE_DEFAULT,
          unreadCount: 0,
        },
      } satisfies ApiResponse<MailboxPage>);
      return;
    }
    next(error);
  }
});

/** GET /emails/:id */
router.get("/:id", async (req, res, next) => {
  try {
    const rawId = z.string().min(1).parse(req.params.id);
    const parsed = parseMailboxId(rawId);
    if (parsed?.direction === "received") {
      const row = await prisma.receivedEmail.findUnique({
        where: { id: parsed.id },
        include: receivedInclude,
      });
      if (!row) throw new AppError(404, "E-mail não encontrado");
      res.json({
        data: serializeMailboxFromReceived(row),
      } satisfies ApiResponse<MailboxItem>);
      return;
    }

    const sentId = parsed?.id ?? rawId;
    const row = await prisma.sentEmail.findUnique({
      where: { id: sentId },
      include: sentInclude,
    });
    if (!row) throw new AppError(404, "E-mail não encontrado");
    res.json({
      data: serializeMailboxFromSent(row),
    } satisfies ApiResponse<MailboxItem>);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "ID inválido"));
      return;
    }
    next(error);
  }
});

/** PATCH /emails/:id/read — marca resposta como lida */
router.patch("/:id/read", async (req, res, next) => {
  try {
    const rawId = z.string().min(1).parse(req.params.id);
    const parsed = parseMailboxId(rawId);
    if (parsed?.direction !== "received") {
      res.json({ data: { ok: true } } satisfies ApiResponse<{ ok: boolean }>);
      return;
    }
    await prisma.receivedEmail.updateMany({
      where: { id: parsed.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ data: { ok: true } } satisfies ApiResponse<{ ok: boolean }>);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "ID inválido"));
      return;
    }
    next(error);
  }
});

async function deleteMailboxIds(ids: string[]) {
  const sentIds: string[] = [];
  const receivedIds: string[] = [];
  for (const raw of ids) {
    const parsed = parseMailboxId(raw);
    if (parsed?.direction === "received") receivedIds.push(parsed.id);
    else sentIds.push(parsed?.id ?? raw);
  }

  const ops: Promise<unknown>[] = [];
  if (sentIds.length) {
    ops.push(prisma.sentEmail.deleteMany({ where: { id: { in: sentIds } } }));
  }
  if (receivedIds.length) {
    ops.push(
      prisma.receivedEmail.deleteMany({ where: { id: { in: receivedIds } } }),
    );
  }
  await Promise.all(ops);
  return { sent: sentIds.length, received: receivedIds.length };
}

/** POST /emails/bulk-delete */
router.post("/bulk-delete", async (req, res, next) => {
  try {
    const body = z
      .object({
        ids: z.array(z.string().min(1)).min(1).max(200),
      })
      .parse(req.body);
    const result = await deleteMailboxIds(body.ids);
    res.json({
      data: { ok: true, ...result },
    } satisfies ApiResponse<{ ok: boolean; sent: number; received: number }>);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, error.issues[0]?.message ?? "IDs inválidos"));
      return;
    }
    next(error);
  }
});

/** DELETE /emails/:id */
router.delete("/:id", async (req, res, next) => {
  try {
    const rawId = z.string().min(1).parse(req.params.id);
    await deleteMailboxIds([rawId]);
    res.json({ data: { ok: true } } satisfies ApiResponse<{ ok: boolean }>);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "ID inválido"));
      return;
    }
    next(error);
  }
});

/** POST /emails — envia e-mail livre (qualquer destinatário) */
router.post("/", async (req, res, next) => {
  try {
    const body = sendSchema.parse(req.body);
    const userId = req.user!.id;
    const to = body.to.trim().toLowerCase();

    const [signatureRow, sender] = await Promise.all([
      prisma.emailSignature.findUnique({ where: { userId } }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      }),
    ]);

    const signature = serializeSignature(signatureRow);
    const { html, text } = await renderProspectEmailHtml({
      message: body.body,
      subject: body.subject,
      signature,
      includeSignature: body.includeSignature,
      fallbackName: sender?.name,
      fontFamily: body.fontFamily,
    });

    const replyTo = resolveReplyToEmail(signature);
    const sent = await sendProspectEmail({
      to,
      subject: body.subject.trim(),
      html,
      text,
      replyTo,
    });

    const matchedProspect = await prisma.prospect.findFirst({
      where: { email: { equals: to, mode: "insensitive" } },
      select: { id: true, status: true, name: true },
    });

    let statusUpdated = false;
    if (matchedProspect) {
      await prisma.prospectActivity.create({
        data: {
          prospectId: matchedProspect.id,
          userId,
          type: "EMAIL",
          content: [
            `Enviado via Compose para ${to}`,
            `Assunto: ${body.subject.trim()}`,
            `Reply-To: ${replyTo}`,
            sent?.id ? `ID: ${sent.id}` : null,
            "",
            body.body.trim().slice(0, 800),
          ]
            .filter((line) => line !== null)
            .join("\n"),
        },
      });

      if (matchedProspect.status === "NEW") {
        await prisma.prospect.update({
          where: { id: matchedProspect.id },
          data: { status: "CONTACTED" },
        });
        statusUpdated = true;
      }
    }

    const saved = await prisma.sentEmail.create({
      data: {
        userId,
        prospectId: matchedProspect?.id ?? null,
        toEmail: to,
        toName: matchedProspect?.name ?? null,
        subject: body.subject.trim(),
        body: body.body.trim(),
        replyTo,
        providerId: sent?.id ?? null,
      },
      include: sentInclude,
    });

    res.status(201).json({
      data: {
        emailId: sent?.id ?? null,
        replyTo: sent.replyTo,
        prospectId: matchedProspect?.id ?? null,
        statusUpdated,
        sentEmail: serializeSentEmail(saved),
      },
    } satisfies ApiResponse<{
      emailId: string | null;
      replyTo: string;
      prospectId: string | null;
      statusUpdated: boolean;
      sentEmail: SentEmail;
    }>);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, error.issues[0]?.message ?? "Dados inválidos"));
      return;
    }
    next(error);
  }
});

export default router;
