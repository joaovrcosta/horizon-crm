import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "./errors";

const MAX_SKEW_SECONDS = 5 * 60;

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

function signaturesMatch(expected: string, candidate: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(candidate);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Verifica a assinatura Svix do webhook Resend e devolve o JSON. */
export function verifyResendWebhook(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
): unknown {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  const svixId =
    headerValue(headers, "svix-id") || headerValue(headers, "webhook-id");
  const svixTimestamp =
    headerValue(headers, "svix-timestamp") ||
    headerValue(headers, "webhook-timestamp");
  const svixSignature =
    headerValue(headers, "svix-signature") ||
    headerValue(headers, "webhook-signature");

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new AppError(401, "RESEND_WEBHOOK_SECRET não configurado");
    }
    console.warn(
      "[webhook] RESEND_WEBHOOK_SECRET ausente — assinatura não verificada (dev)",
    );
    return JSON.parse(rawBody) as unknown;
  }

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new AppError(400, "Cabeçalhos de assinatura ausentes");
  }

  const timestamp = Number(svixTimestamp);
  if (!Number.isFinite(timestamp)) {
    throw new AppError(400, "Timestamp do webhook inválido");
  }
  if (Math.abs(Date.now() / 1000 - timestamp) > MAX_SKEW_SECONDS) {
    throw new AppError(400, "Webhook expirado");
  }

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", secretBytes)
    .update(`${svixId}.${svixTimestamp}.${rawBody}`)
    .digest("base64");

  const candidates = svixSignature
    .split(/\s+/)
    .map((part) => {
      const comma = part.indexOf(",");
      return (comma >= 0 ? part.slice(comma + 1) : part).trim();
    })
    .filter(Boolean);

  if (!candidates.some((candidate) => signaturesMatch(expected, candidate))) {
    throw new AppError(401, "Assinatura do webhook inválida");
  }

  return JSON.parse(rawBody) as unknown;
}
