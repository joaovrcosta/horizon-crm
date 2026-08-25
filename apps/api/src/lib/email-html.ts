const ALLOWED_FONTS = new Set([
  "Georgia, 'Times New Roman', Times, serif",
  "Arial, Helvetica, sans-serif",
  "'Times New Roman', Times, serif",
  "Verdana, Geneva, sans-serif",
  "Tahoma, Geneva, sans-serif",
  "'Trebuchet MS', Helvetica, sans-serif",
  "'Courier New', Courier, monospace",
]);

export const DEFAULT_EMAIL_FONT =
  "Georgia, 'Times New Roman', Times, serif";

export function resolveEmailFont(fontFamily?: string | null) {
  const value = fontFamily?.trim();
  if (value && ALLOWED_FONTS.has(value)) return value;
  return DEFAULT_EMAIL_FONT;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plainTextToHtml(text: string) {
  return escapeHtml(text.trim()).replace(/\r\n|\r|\n/g, "<br>");
}

function sanitizeHref(href: string) {
  const t = href.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t) || /^mailto:/i.test(t)) return t;
  return "";
}

/**
 * Sanitiza HTML do corpo do e-mail: só tags básicas + links.
 * Remove scripts, eventos e estilos perigosos.
 */
export function sanitizeEmailHtml(input: string) {
  let html = input
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button|meta|link)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button|meta|link)[^>]*\/?\s*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)/gi, "");

  html = html.replace(
    /<\s*a\b([^>]*)>([\s\S]*?)<\s*\/\s*a\s*>/gi,
    (_match, attrs: string, inner: string) => {
      const hrefMatch = attrs.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const rawHref = hrefMatch?.[2] ?? hrefMatch?.[3] ?? hrefMatch?.[4] ?? "";
      const href = sanitizeHref(rawHref);
      if (!href) return inner;
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="color:#1a73e8;text-decoration:underline">${inner}</a>`;
    },
  );

  // Remove tags não permitidas (mantém conteúdo)
  html = html.replace(
    /<\/?(?!\/?(?:a|br|p|div|span|b|strong|i|em|u)\b)[a-z][^>]*>/gi,
    "",
  );

  // Limpa atributos de tags restantes, exceto href já tratado em <a>
  html = html.replace(
    /<\s*(br|p|div|span|b|strong|i|em|u)\b[^>]*\/?\s*>/gi,
    (_match, tag: string) => {
      const t = tag.toLowerCase();
      if (t === "br") return "<br>";
      return `<${t}>`;
    },
  );
  html = html.replace(/<\s*\/\s*(p|div|span|b|strong|i|em|u)\s*>/gi, "</$1>");

  return html.trim();
}

export function htmlToPlainText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Prepara HTML final do corpo (texto puro ou HTML do editor). */
export function prepareEmailMessageHtml(message: string) {
  const trimmed = message.trim();
  if (!trimmed) return "";
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return sanitizeEmailHtml(trimmed);
  }
  return plainTextToHtml(trimmed);
}
