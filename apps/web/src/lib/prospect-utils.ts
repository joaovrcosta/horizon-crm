import { digitsOnly } from "@horizon/shared";

export function toWhatsAppLink(value: string | null | undefined) {
  const digits = digitsOnly(value);
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

export function toTelLink(value: string | null | undefined) {
  const digits = digitsOnly(value);
  if (!digits) return null;
  return `tel:+${digits}`;
}

export function toDatetimeLocalValue(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

const APP_TIMEZONE = "America/Sao_Paulo";

function calendarDayInAppTz(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isOverdue(iso: string | null | undefined, status: string) {
  if (!iso || status === "WON" || status === "LOST") return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return calendarDayInAppTz(date) < calendarDayInAppTz(new Date());
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

type PromptVars = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  category?: string | null;
  website?: string | null;
  /** Nome da pessoa logada (consultor / conta). */
  consultantName?: string | null;
};

/** Variáveis disponíveis em templates de e-mail. */
export const PROMPT_TEMPLATE_VARIABLE_HINTS = [
  { keys: ["nome", "name"], label: "Nome do cliente" },
  { keys: ["email"], label: "E-mail do cliente" },
  { keys: ["telefone", "phone"], label: "Telefone ou WhatsApp" },
  { keys: ["endereco", "address"], label: "Endereço" },
  { keys: ["categoria", "category"], label: "Categoria" },
  { keys: ["website"], label: "Site" },
  {
    keys: ["consultantName", "consultor"],
    label: "Nome da pessoa da conta (quem envia)",
  },
] as const;

export function formatPromptVariableTokens(keys: readonly string[]) {
  return keys.map((key) => `{{${key}}}`).join(" ou ");
}

/** Replace {{nome}}, {{consultantName}}, etc. in prompt content. */
export function applyPromptTemplate(template: string, vars: PromptVars) {
  const map: Record<string, string> = {
    nome: vars.name ?? "",
    name: vars.name ?? "",
    email: vars.email ?? "",
    telefone: vars.phone ?? "",
    phone: vars.phone ?? "",
    endereco: vars.address ?? "",
    address: vars.address ?? "",
    categoria: vars.category ?? "",
    category: vars.category ?? "",
    website: vars.website ?? "",
    consultantname: vars.consultantName ?? "",
    consultor: vars.consultantName ?? "",
  };

  return template.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_, key: string) => {
    return map[key.toLowerCase()] ?? "";
  });
}

export function normalizeTagKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function filterPromptsByCategory<T extends { tags: string[] }>(
  prompts: T[],
  category: string | null | undefined,
): T[] {
  const key = category ? normalizeTagKey(category) : "";
  if (!key) return prompts;
  return prompts.filter((prompt) =>
    prompt.tags.some((tag) => normalizeTagKey(tag) === key),
  );
}

export function toMailtoLink(opts: {
  to: string;
  subject?: string;
  body?: string;
}) {
  // URLSearchParams usa "+" para espaços; mailto precisa de %20
  const parts: string[] = [];
  if (opts.subject?.trim()) {
    parts.push(`subject=${encodeURIComponent(opts.subject.trim())}`);
  }
  if (opts.body?.trim()) {
    parts.push(`body=${encodeURIComponent(opts.body.trim())}`);
  }
  return `mailto:${opts.to}${parts.length ? `?${parts.join("&")}` : ""}`;
}
