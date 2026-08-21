import { Router } from "express";
import { z } from "zod";
import type { ApiResponse, EmailSignature } from "@horizon/shared";
import { DEFAULT_EMAIL_LOGO_URL } from "@horizon/shared";
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

const updateSchema = z.object({
  enabled: z.boolean(),
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
    displayName: row.displayName,
    title: row.title,
    phone: row.phone,
    logoUrl: row.logoUrl?.startsWith("/")
    ? DEFAULT_EMAIL_LOGO_URL
    : row.logoUrl,
    company: row.company,
    tagline: row.tagline,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    website: row.website,
    defaultIntro: row.defaultIntro,
    updatedAt: row.updatedAt.toISOString(),
  };
}

const emptySignature = (userId: string): EmailSignature => ({
  id: "",
  userId,
  enabled: true,
  displayName: null,
  title: null,
  phone: null,
  logoUrl: DEFAULT_EMAIL_LOGO_URL,
  company: "halk.",
  tagline: null,
  addressLine1: null,
  addressLine2: null,
  website: null,
  defaultIntro: null,
  updatedAt: new Date().toISOString(),
});

router.use(requireAuth);

router.get("/email-signature", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const row = await prisma.emailSignature.findUnique({ where: { userId } });
    const data = row ? serialize(row) : emptySignature(userId);
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
        displayName: body.displayName,
        title: body.title,
        phone: body.phone,
        logoUrl: body.logoUrl ?? DEFAULT_EMAIL_LOGO_URL,
        company: body.company,
        tagline: body.tagline,
        addressLine1: body.addressLine1,
        addressLine2: body.addressLine2,
        website: body.website,
        defaultIntro: body.defaultIntro,
      },
      update: {
        enabled: body.enabled,
        displayName: body.displayName,
        title: body.title,
        phone: body.phone,
        logoUrl: body.logoUrl ?? DEFAULT_EMAIL_LOGO_URL,
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
