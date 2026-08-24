import { Router } from "express";
import { z } from "zod";
import type { ApiResponse } from "@horizon/shared";
import { DEFAULT_EMAIL_REPLY_TO, type EmailSignature } from "@horizon/shared";
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

router.use(requireAuth);

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
      select: { id: true, status: true },
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

    res.status(201).json({
      data: {
        emailId: sent?.id ?? null,
        replyTo: sent.replyTo,
        prospectId: matchedProspect?.id ?? null,
        statusUpdated,
      },
    } satisfies ApiResponse<{
      emailId: string | null;
      replyTo: string;
      prospectId: string | null;
      statusUpdated: boolean;
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
