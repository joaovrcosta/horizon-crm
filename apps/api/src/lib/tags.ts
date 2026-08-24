import type { ProspectTag, ProspectTagKind } from "@horizon/shared";
import { ProspectTagKind as PrismaTagKind } from "@prisma/client";
import { AppError } from "./errors";
import { prisma } from "./prisma";

export function normalizeTagName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 80);
}

export function slugifyTag(name: string) {
  return normalizeTagName(name)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function serializeTag(tag: {
  id: string;
  kind: PrismaTagKind;
  name: string;
}): ProspectTag {
  return {
    id: tag.id,
    kind: tag.kind,
    name: tag.name,
  };
}

export async function upsertTag(kind: ProspectTagKind, rawName: string) {
  const name = normalizeTagName(rawName);
  const slug = slugifyTag(name);
  if (!name || !slug) {
    throw new AppError(400, "Tag inválida.");
  }

  return prisma.prospectTag.upsert({
    where: { kind_slug: { kind, slug } },
    create: { kind, name, slug },
    update: {},
  });
}

export async function resolveTagName(
  kind: ProspectTagKind,
  rawName: string | null | undefined,
) {
  if (!rawName?.trim()) return null;
  const tag = await upsertTag(kind, rawName);
  return tag.name;
}

export async function resolveTagNames(
  kind: ProspectTagKind,
  names: string[] | undefined,
) {
  if (!names) return [];
  const resolved: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const tag = await upsertTag(kind, raw);
    if (seen.has(tag.slug)) continue;
    seen.add(tag.slug);
    resolved.push(tag.name);
  }
  return resolved;
}

export async function findTagByQuery(kind: ProspectTagKind, raw: string) {
  const slug = slugifyTag(raw);
  const name = normalizeTagName(raw);
  return prisma.prospectTag.findFirst({
    where: {
      kind,
      OR: [
        ...(slug ? [{ slug }] : []),
        { name: { equals: name, mode: "insensitive" as const } },
      ],
    },
  });
}
