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

export async function findExistingTag(kind: ProspectTagKind, rawName: string) {
  const name = normalizeTagName(rawName);
  const slug = slugifyTag(name);
  if (!name && !slug) return null;

  const matches = await prisma.prospectTag.findMany({
    where: {
      kind,
      OR: [
        ...(slug ? [{ slug }] : []),
        ...(name ? [{ name: { equals: name, mode: "insensitive" as const } }] : []),
      ],
    },
  });
  const bySlug = matches.find((tag) => slugifyTag(tag.name) === slug || tag.slug === slug);
  if (bySlug) return bySlug;

  const siblings = await prisma.prospectTag.findMany({ where: { kind } });
  return (
    siblings.find(
      (tag) => slugifyTag(tag.name) === slug || tag.slug === slug,
    ) ?? null
  );
}

export async function upsertTag(kind: ProspectTagKind, rawName: string) {
  const name = normalizeTagName(rawName);
  const slug = slugifyTag(name);
  if (!name || !slug) {
    throw new AppError(400, "Tag inválida.");
  }

  const existing = await findExistingTag(kind, name);
  if (existing) return existing;

  try {
    return await prisma.prospectTag.create({
      data: { kind, name, slug },
    });
  } catch {
    const retry = await findExistingTag(kind, name);
    if (retry) return retry;
    throw new AppError(409, "Já existe uma tag com esse nome.");
  }
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
  return findExistingTag(kind, raw);
}

export async function renameTag(id: string, rawName: string) {
  const tag = await prisma.prospectTag.findUnique({ where: { id } });
  if (!tag) {
    throw new AppError(404, "Tag não encontrada.");
  }

  const name = normalizeTagName(rawName);
  const slug = slugifyTag(name);
  if (!name || !slug) {
    throw new AppError(400, "Tag inválida.");
  }

  if (tag.name === name && tag.slug === slug) {
    return tag;
  }

  const clash = await findExistingTag(tag.kind, name);
  if (clash && clash.id !== tag.id) {
    throw new AppError(409, "Já existe uma tag com esse nome.");
  }

  const oldName = tag.name;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.prospectTag.update({
      where: { id },
      data: { name, slug },
    });

    if (tag.kind === PrismaTagKind.CATEGORY) {
      await tx.prospect.updateMany({
        where: { category: { equals: oldName, mode: "insensitive" } },
        data: { category: name },
      });

      const prompts = await tx.prompt.findMany({
        where: { tags: { has: oldName } },
      });
      for (const prompt of prompts) {
        await tx.prompt.update({
          where: { id: prompt.id },
          data: {
            tags: prompt.tags.map((item) =>
              item.toLowerCase() === oldName.toLowerCase() ? name : item,
            ),
          },
        });
      }
    } else {
      const prospects = await tx.prospect.findMany({
        where: { languages: { has: oldName } },
        select: { id: true, languages: true },
      });
      for (const prospect of prospects) {
        await tx.prospect.update({
          where: { id: prospect.id },
          data: {
            languages: prospect.languages.map((item) =>
              item.toLowerCase() === oldName.toLowerCase() ? name : item,
            ),
          },
        });
      }
    }

    return updated;
  });
}

export async function deleteTag(id: string) {
  const tag = await prisma.prospectTag.findUnique({ where: { id } });
  if (!tag) {
    throw new AppError(404, "Tag não encontrada.");
  }

  await prisma.$transaction(async (tx) => {
    if (tag.kind === PrismaTagKind.CATEGORY) {
      await tx.prospect.updateMany({
        where: { category: { equals: tag.name, mode: "insensitive" } },
        data: { category: null },
      });

      const prompts = await tx.prompt.findMany({
        where: { tags: { has: tag.name } },
      });
      for (const prompt of prompts) {
        await tx.prompt.update({
          where: { id: prompt.id },
          data: {
            tags: prompt.tags.filter(
              (item) => item.toLowerCase() !== tag.name.toLowerCase(),
            ),
          },
        });
      }
    } else {
      const prospects = await tx.prospect.findMany({
        where: { languages: { has: tag.name } },
        select: { id: true, languages: true },
      });
      for (const prospect of prospects) {
        await tx.prospect.update({
          where: { id: prospect.id },
          data: {
            languages: prospect.languages.filter(
              (item) => item.toLowerCase() !== tag.name.toLowerCase(),
            ),
          },
        });
      }
    }

    await tx.prospectTag.delete({ where: { id } });
  });
}
