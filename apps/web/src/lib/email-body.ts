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
