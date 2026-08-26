import type { EmailDeliveryStatus } from "@prisma/client";
import { prisma } from "./prisma";

export type DeliveryWebhookInput = {
  providerId: string;
  status: EmailDeliveryStatus;
  occurredAt?: string | null;
};

export type DeliveryUpdateResult = {
  id: string | null;
  updated: boolean;
  status: EmailDeliveryStatus;
};

function parseOccurredAt(value?: string | null): Date {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

/** Atualiza o status de entrega do SentEmail pelo providerId (Resend email_id). */
export async function updateSentEmailDelivery(
  input: DeliveryWebhookInput,
): Promise<DeliveryUpdateResult> {
  const existing = await prisma.sentEmail.findFirst({
    where: { providerId: input.providerId },
    select: {
      id: true,
      deliveryStatus: true,
      deliveredAt: true,
    },
  });

  if (!existing) {
    return {
      id: null,
      updated: false,
      status: input.status,
    };
  }

  // Não rebaixar DELIVERED para SENT; permitir BOUNCED/FAILED depois.
  if (
    existing.deliveryStatus === input.status &&
    (input.status !== "DELIVERED" || existing.deliveredAt)
  ) {
    return {
      id: existing.id,
      updated: false,
      status: existing.deliveryStatus,
    };
  }

  const occurredAt = parseOccurredAt(input.occurredAt);
  const updated = await prisma.sentEmail.update({
    where: { id: existing.id },
    data: {
      deliveryStatus: input.status,
      deliveryUpdatedAt: occurredAt,
      ...(input.status === "DELIVERED"
        ? { deliveredAt: existing.deliveredAt ?? occurredAt }
        : {}),
    },
    select: { id: true, deliveryStatus: true },
  });

  return {
    id: updated.id,
    updated: true,
    status: updated.deliveryStatus,
  };
}
