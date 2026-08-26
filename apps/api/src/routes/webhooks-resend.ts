import { Router } from "express";
import { z } from "zod";
import type { EmailDeliveryStatus } from "@prisma/client";
import { AppError } from "../lib/errors";
import { ingestReceivedEmail } from "../lib/ingest-received-email";
import { updateSentEmailDelivery } from "../lib/update-sent-email-delivery";
import { verifyResendWebhook } from "../lib/resend-webhook";

const router = Router();

const DELIVERY_EVENTS: Record<string, EmailDeliveryStatus> = {
  "email.delivered": "DELIVERED",
  "email.bounced": "BOUNCED",
  "email.failed": "FAILED",
  "email.complained": "COMPLAINED",
};

const eventSchema = z.object({
  type: z.string(),
  created_at: z.string().optional(),
  data: z
    .object({
      email_id: z.string().optional(),
      id: z.string().optional(),
      from: z.string().optional(),
      to: z.union([z.string(), z.array(z.string())]).optional(),
      subject: z.string().nullable().optional(),
      created_at: z.string().optional(),
    })
    .passthrough(),
});

function rawBody(req: { body: unknown }): string {
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (typeof req.body === "string") return req.body;
  return JSON.stringify(req.body ?? {});
}

router.post("/", async (req, res, next) => {
  try {
    const payload = verifyResendWebhook(rawBody(req), req.headers);
    const event = eventSchema.parse(payload);

    if (event.type === "email.received") {
      const providerId = event.data.email_id ?? event.data.id;
      if (!providerId) {
        throw new AppError(400, "email_id ausente no webhook");
      }

      const result = await ingestReceivedEmail({
        providerId,
        from: event.data.from ?? "",
        to: event.data.to ?? [],
        subject: event.data.subject,
        createdAt: event.data.created_at ?? event.created_at,
      });

      console.info("[webhook] email.received", {
        providerId,
        id: result.id,
        duplicate: result.duplicate,
      });

      res.json({ ok: true, ...result });
      return;
    }

    const deliveryStatus = DELIVERY_EVENTS[event.type];
    if (deliveryStatus) {
      const providerId = event.data.email_id ?? event.data.id;
      if (!providerId) {
        throw new AppError(400, "email_id ausente no webhook");
      }

      const result = await updateSentEmailDelivery({
        providerId,
        status: deliveryStatus,
        occurredAt: event.created_at ?? event.data.created_at,
      });

      console.info(`[webhook] ${event.type}`, {
        providerId,
        id: result.id,
        updated: result.updated,
        status: result.status,
      });

      res.json({ ok: true, ...result });
      return;
    }

    res.json({ ok: true, ignored: event.type });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, error.issues[0]?.message ?? "Payload inválido"));
      return;
    }
    next(error);
  }
});

export default router;
