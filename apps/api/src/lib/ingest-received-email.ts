import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { fetchReceivedEmail } from "./resend";

const BODY_MAX_CHARS = 400_000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type IngestReceivedInput = {
  providerId: string;
  from: string;
  to: string | string[];
  subject?: string | null;
  createdAt?: string | null;
};

export type IngestedReceivedEmail = {
  id: string;
  duplicate: boolean;
};

type ParsedAddress = { email: string; name: string | null };

export function parseAddress(value: string | null | undefined): ParsedAddress {
  const raw = value?.trim() ?? "";
  if (!raw) return { email: "", name: null };
  const angle = raw.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (angle) {
    const name = angle[1]!.replace(/^["']|["']$/g, "").trim();
    return { email: angle[2]!.trim().toLowerCase(), name: name || null };
  }
  return { email: raw.toLowerCase(), name: null };
}

function asAddressList(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [value];
  return items
    .map((item) => parseAddress(item).email)
    .filter((email) => email.includes("@"));
}

export function normalizeSubject(subject: string): string {
  let value = subject.trim();
  let previous = "";
  while (value !== previous) {
    previous = value;
    value = value.replace(/^(re|res|fw|fwd|enc)\s*:\s*/i, "").trim();
  }
  return value.toLowerCase();
}

export function looksLikeReply(subject: string): boolean {
  return /^(re|res|fw|fwd|enc)\s*:/i.test(subject.trim());
}

function uniqueEmails(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim().toLowerCase()).filter(Boolean))];
}

function clipBody(value: string): string {
  if (value.length <= BODY_MAX_CHARS) return value;
  return value.slice(0, BODY_MAX_CHARS);
}

function isUniqueConstraint(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

async function resolveOwnerUserId(
  toEmails: string[],
  sentUserId: string | null,
): Promise<string | null> {
  if (sentUserId) return sentUserId;
  if (toEmails.length === 0) return null;

  const signature = await prisma.emailSignature.findFirst({
    where: {
      OR: toEmails.map((email) => ({
        replyToEmail: { equals: email, mode: "insensitive" as const },
      })),
    },
    select: { userId: true },
  });
  if (signature?.userId) return signature.userId;

  const sentByReplyTo = await prisma.sentEmail.findFirst({
    where: {
      OR: toEmails.map((email) => ({
        replyTo: { equals: email, mode: "insensitive" as const },
      })),
    },
    orderBy: { createdAt: "desc" },
    select: { userId: true },
  });
  return sentByReplyTo?.userId ?? null;
}

async function matchSentEmail(fromEmail: string, subject: string) {
  if (!fromEmail.includes("@")) return null;
  const candidates = await prisma.sentEmail.findMany({
    where: { toEmail: { equals: fromEmail, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: { id: true, userId: true, prospectId: true, subject: true, createdAt: true },
  });
  if (candidates.length === 0) return null;

  const key = normalizeSubject(subject);
  const bySubject = key
    ? candidates.find((item) => normalizeSubject(item.subject) === key)
    : undefined;
  if (bySubject) return bySubject;

  if (!looksLikeReply(subject)) return null;
  const latest = candidates[0]!;
  const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
  if (Date.now() - latest.createdAt.getTime() > sixtyDaysMs) return null;
  return latest;
}

export async function ingestReceivedEmail(
  input: IngestReceivedInput,
): Promise<IngestedReceivedEmail> {
  const existing = await prisma.receivedEmail.findUnique({
    where: { providerId: input.providerId },
    select: { id: true },
  });
  if (existing) {
    return { id: existing.id, duplicate: true };
  }

  const fetched = UUID_RE.test(input.providerId)
    ? await fetchReceivedEmail(input.providerId).catch((error) => {
        console.warn("[email] falha ao buscar e-mail recebido", input.providerId, error);
        return null;
      })
    : null;

  const fromParsed = parseAddress(fetched?.from || input.from);
  const toEmails = uniqueEmails([
    ...asAddressList(input.to),
    ...asAddressList(fetched?.to),
  ]);
  const toEmail =
    toEmails[0] ||
    parseAddress(Array.isArray(input.to) ? input.to[0] : input.to).email;
  const subject = (fetched?.subject ?? input.subject ?? "(sem assunto)").trim();
  const body = clipBody((fetched?.html || fetched?.text || "").trim());
  const createdAt = fetched?.created_at || input.createdAt || null;

  const sent = await matchSentEmail(fromParsed.email, subject);
  const prospect =
    fromParsed.email.includes("@")
      ? await prisma.prospect.findFirst({
          where: { email: { equals: fromParsed.email, mode: "insensitive" } },
          select: { id: true },
        })
      : null;

  const userId = await resolveOwnerUserId(toEmails, sent?.userId ?? null);
  const isReply = Boolean(sent) || looksLikeReply(subject);

  try {
    const saved = await prisma.receivedEmail.create({
      data: {
        userId,
        prospectId: prospect?.id ?? sent?.prospectId ?? null,
        sentEmailId: sent?.id ?? null,
        fromEmail: fromParsed.email || "unknown",
        fromName: fromParsed.name,
        toEmail: toEmail || toEmails[0] || "unknown",
        subject,
        body,
        isReply,
        providerId: input.providerId,
        ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
      },
      select: { id: true, prospectId: true, userId: true, fromEmail: true },
    });

    if (saved.prospectId && saved.userId) {
      await prisma.prospectActivity.create({
        data: {
          prospectId: saved.prospectId,
          userId: saved.userId,
          type: "EMAIL",
          content: [
            `Resposta recebida de ${saved.fromEmail}`,
            `Assunto: ${subject}`,
            `ID: ${input.providerId}`,
            "",
            body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 800),
          ].join("\n"),
        },
      });
    }

    return { id: saved.id, duplicate: false };
  } catch (error) {
    if (isUniqueConstraint(error)) {
      const row = await prisma.receivedEmail.findUnique({
        where: { providerId: input.providerId },
        select: { id: true },
      });
      return { id: row?.id ?? "", duplicate: true };
    }
    throw error;
  }
}
