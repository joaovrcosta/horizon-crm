import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { ApiResponse, EmailSignature, MailboxItem, SentEmail } from "@horizon/shared";
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

const listSchema = z.object({
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
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
  createdAt: Date;
  user: { name: string };
  prospect: { name: string } | null;
}): MailboxItem {
  return {
    id: mailboxId("sent", row.id),
    direction: "sent",
    isReply: false,
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
  providerId: string;
  createdAt: Date;
  user: { name: string } | null;
  prospect: { name: string } | null;
}): MailboxItem {
  return {
    id: mailboxId("received", row.id),
    direction: "received",
    isReply: row.isReply,
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

    const [sentRows, receivedRows] = await Promise.all([
      prisma.sentEmail.findMany({
        where: sentWhere,
        include: sentInclude,
        orderBy: { createdAt: "desc" },
        take: query.limit,
      }),
      prisma.receivedEmail
        .findMany({
          where: receivedWhere,
          include: receivedInclude,
          orderBy: { createdAt: "desc" },
          take: query.limit,
        })
        .catch((error) => {
          if (isMissingMailboxTable(error)) return [];
          throw error;
        }),
    ]);

    const items = [
      ...sentRows.map(serializeMailboxFromSent),
      ...receivedRows.map(serializeMailboxFromReceived),
    ]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, query.limit);

    res.json({
      data: items,
    } satisfies ApiResponse<MailboxItem[]>);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, error.issues[0]?.message ?? "Parâmetros inválidos"));
      return;
    }
    if (isMissingMailboxTable(error)) {
      console.error("Tabela de e-mails ausente. Rode prisma migrate deploy.");
      res.json({ data: [] } satisfies ApiResponse<MailboxItem[]>);
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
