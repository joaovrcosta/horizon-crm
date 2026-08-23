import { Router } from "express";
import { PromptVisibility } from "@prisma/client";
import { z } from "zod";
import type { ApiResponse, Prompt } from "@horizon/shared";
import type { PermissionKey } from "@horizon/shared";
import { AppError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

const visibilityEnum = z.enum(["PUBLIC", "PRIVATE"]);

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(20000),
  tags: z.array(z.string().max(40)).max(20).optional(),
  visibility: visibilityEnum.default("PRIVATE"),
});

const updateSchema = createSchema.partial();

function serializePrompt(p: {
  id: string;
  title: string;
  content: string;
  tags: string[];
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
    visibility: p.visibility,
    createdById: p.createdById,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function canManagePrompt(
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
  return canManagePrompt(user, prompt);
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
      throw new AppError(404, "Prompt não encontrado");
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
    const prompt = await prisma.prompt.create({
      data: {
        title: body.title,
        content: body.content,
        tags: body.tags ?? [],
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
      throw new AppError(404, "Prompt não encontrado");
    }
    if (!canManagePrompt(req.user!, existing)) {
      throw new AppError(403, "Sem permissão para editar este prompt");
    }

    const prompt = await prisma.prompt.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.content !== undefined ? { content: body.content } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
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
      throw new AppError(404, "Prompt não encontrado");
    }
    if (!canManagePrompt(req.user!, existing)) {
      throw new AppError(403, "Sem permissão para remover este prompt");
    }

    await prisma.prompt.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
