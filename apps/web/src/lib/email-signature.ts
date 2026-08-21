import { createElement } from "react";
import { render } from "@react-email/render";
import {
  DEFAULT_EMAIL_LOGO_URL,
  type EmailSignature,
} from "@horizon/shared";
import {
  HalkEmailSignature,
  type HalkSignatureProps,
} from "@/emails/halk-signature";

export type SignatureVars = {
  fallbackName?: string | null;
  origin?: string;
  /** Quando true, baixa o logo e embute em base64 (funciona no Outlook ao colar). */
  embedLogo?: boolean;
};

function isPublicLogoUrl(url: string) {
  return (
    url.startsWith("data:") ||
    (/^https?:\/\//i.test(url) && !/localhost|127\.0\.0\.1/i.test(url))
  );
}

export function resolveLogoUrl(
  logoUrl: string | null | undefined,
  origin?: string,
) {
  if (!logoUrl?.trim()) return DEFAULT_EMAIL_LOGO_URL;
  let url = logoUrl.trim();
  if (url.startsWith("/") || /localhost|127\.0\.0\.1/i.test(url)) {
    return DEFAULT_EMAIL_LOGO_URL;
  }
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  const base = (
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "")
  ).replace(/\/$/, "");
  if (!base) return DEFAULT_EMAIL_LOGO_URL;
  url = url.startsWith("/") ? `${base}${url}` : `${base}/${url}`;
  if (!isPublicLogoUrl(url)) return DEFAULT_EMAIL_LOGO_URL;
  return url;
}

/** Converte URL do logo em data URI via API (evita CORS e funciona no Outlook). */
export async function logoToDataUri(logoUrl: string | null | undefined) {
  const resolved = resolveLogoUrl(logoUrl);
  if (resolved.startsWith("data:")) return resolved;

  try {
    const endpoint = `/api/email-logo?url=${encodeURIComponent(resolved)}`;
    const res = await fetch(endpoint);
    if (!res.ok) return resolved;
    const data = (await res.json()) as { dataUri?: string };
    return data.dataUri || resolved;
  } catch {
    return resolved;
  }
}

export function toSignatureProps(
  sig: EmailSignature,
  opts: SignatureVars & { logoDataUri?: string | null } = {},
): HalkSignatureProps {
  return {
    displayName: sig.displayName?.trim() || opts.fallbackName?.trim() || null,
    title: sig.title,
    phone: sig.phone,
    logoUrl: opts.logoDataUri || resolveLogoUrl(sig.logoUrl, opts.origin),
    company: sig.company,
    tagline: sig.tagline,
    addressLine1: sig.addressLine1,
    addressLine2: sig.addressLine2,
    website: sig.website,
  };
}

export function buildPlainSignature(
  sig: EmailSignature,
  opts: SignatureVars = {},
) {
  if (!sig.enabled) return "";

  const name = sig.displayName?.trim() || opts.fallbackName?.trim() || "";
  const lines: string[] = [];

  if (name) lines.push(name);
  if (sig.title?.trim()) lines.push(sig.title.trim());
  if (sig.phone?.trim()) lines.push(sig.phone.trim());
  if (lines.length) lines.push("");

  if (sig.company?.trim()) {
    const companyLine = sig.tagline?.trim()
      ? `${sig.company.trim()} — ${sig.tagline.trim()}`
      : sig.company.trim();
    lines.push(companyLine);
  } else if (sig.tagline?.trim()) {
    lines.push(sig.tagline.trim());
  }

  if (sig.addressLine1?.trim()) lines.push(sig.addressLine1.trim());
  if (sig.addressLine2?.trim()) lines.push(sig.addressLine2.trim());
  if (sig.website?.trim()) lines.push(sig.website.trim());

  return lines.join("\n").trim();
}

/** HTML da assinatura via React Email, com logo embutido em base64. */
export async function buildHtmlSignature(
  sig: EmailSignature,
  opts: SignatureVars = {},
) {
  if (!sig.enabled) return "";
  const logoDataUri =
    opts.embedLogo === false
      ? null
      : await logoToDataUri(sig.logoUrl);
  const props = toSignatureProps(sig, { ...opts, logoDataUri });
  return render(createElement(HalkEmailSignature, props), {
    pretty: true,
  });
}

/**
 * Copia HTML rico para a área de transferência.
 * Usa contenteditable + execCommand como fallback (melhor no Outlook).
 */
export async function copyHtmlToClipboard(html: string, plain: string) {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      }),
    ]);
    return true;
  } catch {
    /* fallback abaixo */
  }

  const host = document.createElement("div");
  host.contentEditable = "true";
  host.style.position = "fixed";
  host.style.left = "-9999px";
  host.style.top = "0";
  host.setAttribute("aria-hidden", "true");
  host.innerHTML = html;
  document.body.appendChild(host);

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(host);
  selection?.removeAllRanges();
  selection?.addRange(range);

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }

  selection?.removeAllRanges();
  document.body.removeChild(host);

  if (!ok) {
    try {
      await navigator.clipboard.writeText(plain);
      return false;
    } catch {
      return false;
    }
  }
  return true;
}

export function composeEmailBody(opts: {
  message: string;
  signature: EmailSignature | null;
  fallbackName?: string | null;
  includeSignature: boolean;
}) {
  const parts: string[] = [];
  if (opts.message.trim()) parts.push(opts.message.trim());
  if (opts.includeSignature && opts.signature) {
    const sig = buildPlainSignature(opts.signature, {
      fallbackName: opts.fallbackName,
    });
    if (sig) {
      if (parts.length) parts.push("");
      parts.push("—");
      parts.push(sig);
    }
  }
  return parts.join("\n");
}
