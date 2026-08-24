import { Router } from "express";
import { PromptVisibility } from "@prisma/client";
import { z } from "zod";
import type { ApiResponse, Vault } from "@horizon/shared";
import type { PermissionKey } from "@horizon/shared";
import { AppError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

const visibilityEnum = z.enum(["PUBLIC", "PRIVATE"]);

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  visibility: visibilityEnum.default("PRIVATE"),
});

const updateSchema = createSchema.partial();

function serializeVault(v: {
  id: string;
  name: string;
  description: string | null;
  visibility: PromptVisibility;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { items: number };
}): Vault {
  return {
    id: v.id,
    name: v.name,
    description: v.description,
    visibility: v.visibility,
    createdById: v.createdById,
    itemCount: v._count?.items ?? 0,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}

function canManageVault(
  user: { id: string; permissions: readonly string[] },
  vault: { createdById: string },
) {
  return (
    user.permissions.includes("vaults:manage_all" satisfies PermissionKey) ||
    vault.createdById === user.id
  );
}

function canViewVault(
  user: { id: string; permissions: readonly string[] },
  vault: { createdById: string; visibility: PromptVisibility },
) {
  if (vault.visibility === PromptVisibility.PUBLIC) return true;
  return canManageVault(user, vault);
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
      "vaults:manage_all" satisfies PermissionKey,
    );

    const accessFilter = canManageAll
      ? {}
      : {
          OR: [
            { visibility: PromptVisibility.PUBLIC },
            { createdById: userId },
          ],
        };

    const vaults = await prisma.vault.findMany({
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
                    { name: { contains: query.q, mode: "insensitive" as const } },
                    {
                      description: {
                        contains: query.q,
                        mode: "insensitive" as const,
                      },
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      include: { _count: { select: { items: true } } },
      orderBy: { updatedAt: "desc" },
    });

    res.json({
      data: vaults.map(serializeVault),
    } satisfies ApiResponse<Vault[]>);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = z.string().cuid().parse(req.params.id);
    const vault = await prisma.vault.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    });
    if (!vault || !canViewVault(req.user!, vault)) {
      throw new AppError(404, "Cofre não encontrado");
    }
    res.json({
      data: serializeVault(vault),
    } satisfies ApiResponse<Vault>);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const vault = await prisma.vault.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        visibility: body.visibility as PromptVisibility,
        createdById: req.user!.id,
      },
      include: { _count: { select: { items: true } } },
    });

    res.status(201).json({
      data: serializeVault(vault),
    } satisfies ApiResponse<Vault>);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const id = z.string().cuid().parse(req.params.id);
    const body = updateSchema.parse(req.body);

    const existing = await prisma.vault.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, "Cofre não encontrado");
    }
    if (!canManageVault(req.user!, existing)) {
      throw new AppError(403, "Sem permissão para editar este cofre");
    }

    const vault = await prisma.vault.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
        ...(body.visibility !== undefined
          ? { visibility: body.visibility as PromptVisibility }
          : {}),
      },
      include: { _count: { select: { items: true } } },
    });

    res.json({
      data: serializeVault(vault),
    } satisfies ApiResponse<Vault>);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = z.string().cuid().parse(req.params.id);
    const existing = await prisma.vault.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, "Cofre não encontrado");
    }
    if (!canManageVault(req.user!, existing)) {
      throw new AppError(403, "Sem permissão para remover este cofre");
    }

    await prisma.vault.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { canManageVault, canViewVault };
export default router;
