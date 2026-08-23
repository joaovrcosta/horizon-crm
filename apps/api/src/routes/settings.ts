import { Router } from "express";
import { z } from "zod";
import type { ApiResponse, EmailSignature } from "@horizon/shared";
import { DEFAULT_EMAIL_REPLY_TO } from "@horizon/shared";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

const nullableText = z
  .union([z.string().max(500), z.literal(""), z.null()])
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const t = String(v).trim();
    return t.length ? t : null;
  });

const nullableEmail = z
  .union([z.string().email().max(320), z.literal(""), z.null()])
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const t = String(v).trim();
    return t.length ? t : null;
  });

const updateSchema = z.object({
  enabled: z.boolean(),
  replyToEmail: nullableEmail,
  displayName: nullableText,
  title: nullableText,
  phone: nullableText,
  logoUrl: nullableText,
  company: nullableText,
  tagline: z
    .union([z.string().max(1000), z.literal(""), z.null()])
    .transform((v) => {
      if (v === null || v === undefined) return null;
      const t = String(v).trim();
      return t.length ? t : null;
    }),
  addressLine1: nullableText,
  addressLine2: nullableText,
  website: nullableText,
  defaultIntro: z
    .union([z.string().max(8000), z.literal(""), z.null()])
    .transform((v) => {
      if (v === null || v === undefined) return null;
      const t = String(v).trim();
      return t.length ? t : null;
    }),
});

function serialize(row: {
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
}): EmailSignature {
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

/** Assinatura vazia da conta — sem defaults globais da agência. */
function emptySignature(userId: string, userName?: string | null): EmailSignature {
  return {
    id: "",
    userId,
    enabled: false,
    replyToEmail: DEFAULT_EMAIL_REPLY_TO,
    displayName: userName?.trim() || null,
    title: null,
    phone: null,
    logoUrl: null,
    company: null,
    tagline: null,
    addressLine1: null,
    addressLine2: null,
    website: null,
    defaultIntro: null,
    updatedAt: new Date().toISOString(),
  };
}

router.use(requireAuth);

router.get("/email-signature", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const [row, user] = await Promise.all([
      prisma.emailSignature.findUnique({ where: { userId } }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      }),
    ]);

    const data = row ? serialize(row) : emptySignature(userId, user?.name);
    res.json({ data } satisfies ApiResponse<EmailSignature>);
  } catch (error) {
    next(error);
  }
});

router.put("/email-signature", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const body = updateSchema.parse(req.body);

    const row = await prisma.emailSignature.upsert({
      where: { userId },
      create: {
        userId,
        enabled: body.enabled,
        replyToEmail: body.replyToEmail ?? DEFAULT_EMAIL_REPLY_TO,
        displayName: body.displayName,
        title: body.title,
        phone: body.phone,
        logoUrl: body.logoUrl,
        company: body.company,
        tagline: body.tagline,
        addressLine1: body.addressLine1,
        addressLine2: body.addressLine2,
        website: body.website,
        defaultIntro: body.defaultIntro,
      },
      update: {
        enabled: body.enabled,
        replyToEmail: body.replyToEmail ?? DEFAULT_EMAIL_REPLY_TO,
        displayName: body.displayName,
        title: body.title,
        phone: body.phone,
        logoUrl: body.logoUrl,
        company: body.company,
        tagline: body.tagline,
        addressLine1: body.addressLine1,
        addressLine2: body.addressLine2,
        website: body.website,
        defaultIntro: body.defaultIntro,
      },
    });

    res.json({ data: serialize(row) } satisfies ApiResponse<EmailSignature>);
  } catch (error) {
    next(error);
  }
});

export default router;
