import { Router } from "express";
import { z } from "zod";
import type { ApiResponse, EmailSignature, ProspectActivity } from "@horizon/shared";
import { DEFAULT_EMAIL_REPLY_TO } from "@horizon/shared";
import { AppError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import {
  renderProspectEmailHtml,
  resolveReplyToEmail,
  sendProspectEmail,
} from "../lib/resend";
import { requireAuth } from "../middleware/auth";

const router = Router({ mergeParams: true });

const sendSchema = z.object({
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(20000),
  includeSignature: z.boolean().optional().default(true),
});

function serializeActivity(activity: {
  id: string;
  prospectId: string;
  userId: string;
  type: "EMAIL";
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

/** POST /prospects/:id/emails — envia e-mail via Resend */
router.post("/", async (req, res, next) => {
  try {
    const prospectId = z
      .string()
      .cuid()
      .parse((req.params as { id?: string }).id);
    const body = sendSchema.parse(req.body);
    const userId = req.user!.id;

    const prospect = await prisma.prospect.findUnique({
      where: { id: prospectId },
    });
    if (!prospect) {
      throw new AppError(404, "Prospect não encontrado");
    }
    if (!prospect.email?.trim()) {
      throw new AppError(400, "Prospect sem e-mail cadastrado");
    }

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
      to: prospect.email.trim(),
      subject: body.subject.trim(),
      html,
      text,
      replyTo,
    });

    const activity = await prisma.prospectActivity.create({
      data: {
        prospectId,
        userId,
        type: "EMAIL",
        content: [
          `Enviado via Resend para ${prospect.email}`,
          `Assunto: ${body.subject.trim()}`,
          `Reply-To: ${sent.replyTo}`,
          sent?.id ? `ID: ${sent.id}` : null,
          "",
          body.body.trim().slice(0, 800),
        ]
          .filter((line) => line !== null)
          .join("\n"),
      },
      include: { user: { select: { name: true } } },
    });

    if (prospect.status === "NEW") {
      await prisma.prospect.update({
        where: { id: prospectId },
        data: { status: "CONTACTED" },
      });
    }

    res.status(201).json({
      data: {
        emailId: sent?.id ?? null,
        replyTo: sent.replyTo,
        activity: serializeActivity({
          ...activity,
          type: "EMAIL",
        }),
        statusUpdated: prospect.status === "NEW",
      },
    } satisfies ApiResponse<{
      emailId: string | null;
      replyTo: string;
      activity: ProspectActivity;
      statusUpdated: boolean;
    }>);
  } catch (error) {
    next(error);
  }
});

export default router;
