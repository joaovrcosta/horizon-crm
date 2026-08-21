import { createElement } from "react";
import { Resend } from "resend";
import { render } from "@react-email/render";
import {
  DEFAULT_EMAIL_LOGO_URL,
  type EmailSignature,
} from "@horizon/shared";
import { AppError } from "./errors";
import { ProspectOutreachEmail } from "../emails/prospect-outreach";
import type { HalkSignatureProps } from "../emails/halk-signature";

function getResend() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new AppError(
      500,
      "RESEND_API_KEY não configurada. Adicione no apps/api/.env",
    );
  }
  return new Resend(key);
}

function getFrom() {
  const from = process.env.EMAIL_FROM?.trim();
  if (!from) {
    throw new AppError(
      500,
      "EMAIL_FROM não configurado. Ex.: Halk <onboarding@resend.dev>",
    );
  }
  return from;
}

function resolveLogoUrl(logoUrl: string | null | undefined) {
  if (!logoUrl?.trim()) return DEFAULT_EMAIL_LOGO_URL;
  const url = logoUrl.trim();
  if (url.startsWith("/") || /localhost|127\.0\.0\.1/i.test(url)) {
    return DEFAULT_EMAIL_LOGO_URL;
  }
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  return DEFAULT_EMAIL_LOGO_URL;
}

export function toSignatureProps(
  sig: EmailSignature | null,
  fallbackName?: string | null,
): HalkSignatureProps | null {
  if (!sig?.enabled) return null;
  return {
    displayName: sig.displayName?.trim() || fallbackName?.trim() || null,
    title: sig.title,
    phone: sig.phone,
    logoUrl: resolveLogoUrl(sig.logoUrl),
    company: sig.company,
    tagline: sig.tagline,
    addressLine1: sig.addressLine1,
    addressLine2: sig.addressLine2,
    website: sig.website,
  };
}

export async function renderProspectEmailHtml(opts: {
  message: string;
  subject: string;
  signature: EmailSignature | null;
  includeSignature: boolean;
  fallbackName?: string | null;
}) {
  const signatureProps = opts.includeSignature
    ? toSignatureProps(opts.signature, opts.fallbackName)
    : null;

  const html = await render(
    createElement(ProspectOutreachEmail, {
      message: opts.message,
      previewText: opts.subject,
      signature: signatureProps,
      includeSignature: Boolean(signatureProps),
    }),
  );

  const textParts = [opts.message.trim()];
  if (signatureProps) {
    const lines = [
      signatureProps.displayName,
      signatureProps.title,
      signatureProps.phone,
      signatureProps.company,
      signatureProps.tagline,
      signatureProps.addressLine1,
      signatureProps.addressLine2,
      signatureProps.website,
    ].filter(Boolean);
    if (lines.length) {
      textParts.push("", "—", ...lines.map(String));
    }
  }

  return { html, text: textParts.join("\n") };
}

export async function sendProspectEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
}) {
  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: getFrom(),
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    replyTo: opts.replyTo || undefined,
  });

  if (error) {
    throw new AppError(502, error.message || "Falha ao enviar e-mail (Resend)");
  }

  return data;
}
