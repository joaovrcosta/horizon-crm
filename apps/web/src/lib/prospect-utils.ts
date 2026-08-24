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

export function isOverdue(iso: string | null | undefined, status: string) {
  if (!iso || status === "WON" || status === "LOST") return false;
  const date = new Date(iso);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return date < start;
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
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
};

/** Variáveis disponíveis em templates de e-mail (dados do cliente). */
export const PROMPT_TEMPLATE_VARIABLE_HINTS = [
  { keys: ["nome", "name"], label: "Nome do cliente" },
  { keys: ["email"], label: "E-mail" },
  { keys: ["telefone", "phone"], label: "Telefone ou WhatsApp" },
  { keys: ["endereco", "address"], label: "Endereço" },
  { keys: ["categoria", "category"], label: "Categoria" },
  { keys: ["website"], label: "Site" },
] as const;

export function formatPromptVariableTokens(keys: readonly string[]) {
  return keys.map((key) => `{{${key}}}`).join(" ou ");
}

/** Replace {{nome}}, {{name}}, {{email}}, etc. in prompt content. */
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
  };

  return template.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_, key: string) => {
    return map[key.toLowerCase()] ?? "";
  });
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
