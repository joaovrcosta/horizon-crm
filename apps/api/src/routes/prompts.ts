import { Router } from "express";
import { PromptVisibility } from "@prisma/client";
import { z } from "zod";
import type { ApiResponse, Prompt } from "@horizon/shared";
import type { PermissionKey } from "@horizon/shared";
import { AppError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { resolveTagNames } from "../lib/tags";

const router = Router();

const visibilityEnum = z.enum(["PUBLIC", "PRIVATE"]);

const createSchema = z.object({
  title: z
    .string("Informe o título do template.")
    .trim()
    .min(1, "Informe o título do template.")
    .max(200, "O título deve ter no máximo 200 caracteres."),
  content: z
    .string("Preencha o conteúdo do template.")
    .min(1, "Preencha o conteúdo do template.")
    .max(50000, "O conteúdo deve ter no máximo 50.000 caracteres."),
  tags: z
    .array(z.string().max(80, "Cada categoria deve ter no máximo 80 caracteres."))
    .max(20, "Selecione no máximo 20 categorias.")
    .optional(),
  languages: z
    .array(z.string().max(80, "Cada idioma deve ter no máximo 80 caracteres."))
    .min(1, "Selecione pelo menos um idioma.")
    .max(20, "Selecione no máximo 20 idiomas."),
  visibility: visibilityEnum.default("PRIVATE"),
});

const updateSchema = createSchema.partial().extend({
  languages: z
    .array(z.string().max(80, "Cada idioma deve ter no máximo 80 caracteres."))
    .min(1, "Selecione pelo menos um idioma.")
    .max(20, "Selecione no máximo 20 idiomas.")
    .optional(),
});

function serializePrompt(p: {
  id: string;
  title: string;
  content: string;
  tags: string[];
  languages: string[];
  visibility: PromptVisibility;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}): Prompt {
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    tags: p.tags,
    languages: p.languages,
    visibility: p.visibility,
    createdById: p.createdById,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function canManagePrompt(
  user: { id: string; permissions: readonly string[] },
  prompt: { createdById: string; visibility?: PromptVisibility },
) {
  if (user.permissions.includes("prompts:manage_all" satisfies PermissionKey)) {
    return true;
  }
  if (prompt.createdById === user.id) return true;
  // Templates públicos podem ser editados por qualquer membro da equipe
  if (prompt.visibility === PromptVisibility.PUBLIC) return true;
  return false;
}

function canDeletePrompt(
  user: { id: string; permissions: readonly string[] },
  prompt: { createdById: string },
) {
  return (
    user.permissions.includes("prompts:manage_all" satisfies PermissionKey) ||
    prompt.createdById === user.id
  );
}

function canViewPrompt(
  user: { id: string; permissions: readonly string[] },
  prompt: { createdById: string; visibility: PromptVisibility },
) {
  if (prompt.visibility === PromptVisibility.PUBLIC) return true;
  return (
    user.permissions.includes("prompts:manage_all" satisfies PermissionKey) ||
    prompt.createdById === user.id
  );
}

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const query = z
      .object({
        q: z.string().optional(),
        visibility: visibilityEnum.optional(),
      })
      .parse(req.query);

    const userId = req.user!.id;
    const canManageAll = req.user!.permissions.includes(
      "prompts:manage_all" satisfies PermissionKey,
    );

    const accessFilter = canManageAll
      ? {}
      : {
          OR: [
            { visibility: PromptVisibility.PUBLIC },
            { createdById: userId },
          ],
        };

    const prompts = await prisma.prompt.findMany({
      where: {
        AND: [
          accessFilter,
          ...(query.visibility
            ? [{ visibility: query.visibility as PromptVisibility }]
            : []),
          ...(query.q
            ? [
                {
                  OR: [
                    { title: { contains: query.q, mode: "insensitive" as const } },
                    {
                      content: { contains: query.q, mode: "insensitive" as const },
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json({
      data: prompts.map(serializePrompt),
    } satisfies ApiResponse<Prompt[]>);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = z.string().cuid().parse(req.params.id);
    const prompt = await prisma.prompt.findUnique({ where: { id } });
    if (!prompt || !canViewPrompt(req.user!, prompt)) {
      throw new AppError(404, "Template de e-mail não encontrado");
    }
    res.json({
      data: serializePrompt(prompt),
    } satisfies ApiResponse<Prompt>);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const tags = body.tags
      ? await resolveTagNames("CATEGORY", body.tags)
      : [];
    const languages = await resolveTagNames("LANGUAGE", body.languages);
    const prompt = await prisma.prompt.create({
      data: {
        title: body.title,
        content: body.content,
        tags,
        languages,
        visibility: body.visibility as PromptVisibility,
        createdById: req.user!.id,
      },
    });

    res.status(201).json({
      data: serializePrompt(prompt),
    } satisfies ApiResponse<Prompt>);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const id = z.string().cuid().parse(req.params.id);
    const body = updateSchema.parse(req.body);

    const existing = await prisma.prompt.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, "Template de e-mail não encontrado");
    }
    if (!canManagePrompt(req.user!, existing)) {
      throw new AppError(403, "Sem permissão para editar este template");
    }

    const prompt = await prisma.prompt.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.content !== undefined ? { content: body.content } : {}),
        ...(body.tags !== undefined
          ? { tags: await resolveTagNames("CATEGORY", body.tags) }
          : {}),
        ...(body.languages !== undefined
          ? { languages: await resolveTagNames("LANGUAGE", body.languages) }
          : {}),
        ...(body.visibility !== undefined
          ? { visibility: body.visibility as PromptVisibility }
          : {}),
      },
    });

    res.json({
      data: serializePrompt(prompt),
    } satisfies ApiResponse<Prompt>);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = z.string().cuid().parse(req.params.id);
    const existing = await prisma.prompt.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, "Template de e-mail não encontrado");
    }
    if (!canDeletePrompt(req.user!, existing)) {
      throw new AppError(403, "Sem permissão para remover este template");
    }

    await prisma.prompt.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
