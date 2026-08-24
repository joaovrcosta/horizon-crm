import { Router } from "express";
import { z } from "zod";
import type { ApiResponse, EmailSignature, SentEmail } from "@horizon/shared";
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
  body: z.string().min(1).max(20000),
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

/** GET /emails — lista e-mails enviados */
router.get("/", async (req, res, next) => {
  try {
    const query = listSchema.parse(req.query);
    const userId = req.user!.id;

    await backfillFromActivities(userId).catch(() => {
      // não bloqueia a listagem se o backfill falhar
    });

    const q = query.q?.trim();
    const rows = await prisma.sentEmail.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { toEmail: { contains: q, mode: "insensitive" } },
                { toName: { contains: q, mode: "insensitive" } },
                { subject: { contains: q, mode: "insensitive" } },
                { body: { contains: q, mode: "insensitive" } },
                {
                  prospect: {
                    name: { contains: q, mode: "insensitive" },
                  },
                },
              ],
            }
          : {}),
      },
      include: sentInclude,
      orderBy: { createdAt: "desc" },
      take: query.limit,
    });

    res.json({
      data: rows.map(serializeSentEmail),
    } satisfies ApiResponse<SentEmail[]>);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, error.issues[0]?.message ?? "Parâmetros inválidos"));
      return;
    }
    next(error);
  }
});

/** GET /emails/:id */
router.get("/:id", async (req, res, next) => {
  try {
    const id = z.string().cuid().parse(req.params.id);
    const row = await prisma.sentEmail.findUnique({
      where: { id },
      include: sentInclude,
    });
    if (!row) {
      throw new AppError(404, "E-mail não encontrado");
    }
    res.json({
      data: serializeSentEmail(row),
    } satisfies ApiResponse<SentEmail>);
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
