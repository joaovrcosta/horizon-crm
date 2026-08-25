export const EMAIL_FONTS = [
  {
    value: "Georgia, 'Times New Roman', Times, serif",
    label: "Georgia",
  },
  {
    value: "Arial, Helvetica, sans-serif",
    label: "Arial",
  },
  {
    value: "'Times New Roman', Times, serif",
    label: "Times New Roman",
  },
  {
    value: "Verdana, Geneva, sans-serif",
    label: "Verdana",
  },
  {
    value: "Tahoma, Geneva, sans-serif",
    label: "Tahoma",
  },
  {
    value: "'Trebuchet MS', Helvetica, sans-serif",
    label: "Trebuchet MS",
  },
  {
    value: "'Courier New', Courier, monospace",
    label: "Courier New",
  },
] as const;

export const DEFAULT_EMAIL_FONT = EMAIL_FONTS[0].value;

export function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Converte texto puro (templates) em HTML simples para o editor. */
export function plainTextToEditorHtml(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
  return escapeHtml(trimmed).replace(/\r\n|\r|\n/g, "<br>");
}

/** Extrai texto legível de HTML do editor (validação / vazio). */
export function htmlToPlainText(html: string) {
  if (typeof document !== "undefined") {
    const el = document.createElement("div");
    el.innerHTML = html;
    return (el.textContent || el.innerText || "")
      .replace(/\u00a0/g, " ")
      .trim();
  }
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

export function normalizeLinkHref(raw: string) {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t) || /^mailto:/i.test(t)) return t;
  return `https://${t}`;
}

function sanitizeHref(href: string) {
  const t = href.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t) || /^mailto:/i.test(t)) return t;
  return "";
}

/** Sanitiza HTML do corpo: só tags básicas + links seguros. */
export function sanitizeEmailHtml(input: string) {
  let html = input
    .replace(
      /<\s*(script|style|iframe|object|embed|form|input|button|meta|link)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      "",
    )
    .replace(
      /<\s*(script|style|iframe|object|embed|form|input|button|meta|link)[^>]*\/?\s*>/gi,
      "",
    )
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(
      /\s(href|src)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)/gi,
      "",
    );

  html = html.replace(
    /<\s*a\b([^>]*)>([\s\S]*?)<\s*\/\s*a\s*>/gi,
    (_match, attrs: string, inner: string) => {
      const hrefMatch = attrs.match(
        /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i,
      );
      const rawHref = hrefMatch?.[2] ?? hrefMatch?.[3] ?? hrefMatch?.[4] ?? "";
      const href = sanitizeHref(rawHref);
      if (!href) return inner;
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
    },
  );

  html = html.replace(
    /<\/?(?!\/?(?:a|br|p|div|span|b|strong|i|em|u|blockquote)\b)[a-z][^>]*>/gi,
    "",
  );

  html = html.replace(
    /<\s*(br|p|div|span|b|strong|i|em|u|blockquote)\b([^>]*)\/?\s*>/gi,
    (_match, tag: string, attrs: string) => {
      const t = tag.toLowerCase();
      if (t === "br") return "<br>";
      const isQuote =
        t === "blockquote" ||
        /\bclass\s*=\s*(["'])[^"']*\bgmail_quote\b[^"']*\1/i.test(attrs) ||
        /\bclass\s*=\s*[^\s>]*gmail_quote/i.test(attrs);
      if (isQuote) return `<${t} class="email-quote">`;
      return `<${t}>`;
    },
  );
  html = html.replace(
    /<\s*\/\s*(p|div|span|b|strong|i|em|u|blockquote)\s*>/gi,
    "</$1>",
  );

  return html.trim();
}

const QUOTE_MARKER =
  /(?:On\s[\s\S]{0,220}?wrote:|Em\s[\s\S]{0,220}?escreveu:)/i;

/** Envolve o histórico citado (Gmail / texto) para esmaecer na leitura. */
export function wrapQuotedHistory(html: string) {
  if (/class="email-quote"/.test(html)) return html;
  const match = html.match(QUOTE_MARKER);
  if (!match || match.index == null) return html;
  return `${html.slice(0, match.index)}<div class="email-quote">${html.slice(match.index)}</div>`;
}

/** Prepara HTML para exibir o corpo (texto puro ou HTML do editor). */
export function prepareEmailMessageHtml(message: string) {
  const trimmed = message.trim();
  if (!trimmed) return "";
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return wrapQuotedHistory(sanitizeEmailHtml(trimmed));
  }
  return wrapQuotedHistory(escapeHtml(trimmed).replace(/\r\n|\r|\n/g, "<br>"));
}
