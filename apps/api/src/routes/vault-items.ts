import { Router } from "express";
import { z } from "zod";
import type { ApiResponse, VaultItem } from "@horizon/shared";
import { AppError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { requireAuth, type AuthUser } from "../middleware/auth";
import { canManageVault, canViewVault } from "./vaults";

const router = Router({ mergeParams: true });

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(20000),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

const updateSchema = createSchema.partial();

function serializeItem(item: {
  id: string;
  vaultId: string;
  title: string;
  content: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): VaultItem {
  return {
    id: item.id,
    vaultId: item.vaultId,
    title: item.title,
    content: item.content,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

async function getAccessibleVault(vaultId: string, user: AuthUser) {
  const vault = await prisma.vault.findUnique({ where: { id: vaultId } });
  if (!vault || !canViewVault(user, vault)) {
    throw new AppError(404, "Cofre não encontrado");
  }
  return vault;
}

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const vaultId = z.string().cuid().parse(req.params.vaultId);
    await getAccessibleVault(vaultId, req.user!);

    const items = await prisma.vaultItem.findMany({
      where: { vaultId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    res.json({
      data: items.map(serializeItem),
    } satisfies ApiResponse<VaultItem[]>);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const vaultId = z.string().cuid().parse(req.params.vaultId);
    const vault = await getAccessibleVault(vaultId, req.user!);
    if (!canManageVault(req.user!, vault)) {
      throw new AppError(403, "Sem permissão para adicionar itens neste cofre");
    }

    const body = createSchema.parse(req.body);
    let sortOrder = body.sortOrder;
    if (sortOrder === undefined) {
      const last = await prisma.vaultItem.findFirst({
        where: { vaultId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      sortOrder = (last?.sortOrder ?? -1) + 1;
    }

    const item = await prisma.vaultItem.create({
      data: {
        vaultId,
        title: body.title,
        content: body.content,
        sortOrder,
      },
    });

    await prisma.vault.update({
      where: { id: vaultId },
      data: { updatedAt: new Date() },
    });

    res.status(201).json({
      data: serializeItem(item),
    } satisfies ApiResponse<VaultItem>);
  } catch (error) {
    next(error);
  }
});

router.patch("/:itemId", async (req, res, next) => {
  try {
    const vaultId = z.string().cuid().parse(req.params.vaultId);
    const itemId = z.string().cuid().parse(req.params.itemId);
    const vault = await getAccessibleVault(vaultId, req.user!);
    if (!canManageVault(req.user!, vault)) {
      throw new AppError(403, "Sem permissão para editar itens neste cofre");
    }

    const existing = await prisma.vaultItem.findFirst({
      where: { id: itemId, vaultId },
    });
    if (!existing) {
      throw new AppError(404, "Item não encontrado");
    }

    const body = updateSchema.parse(req.body);
    const item = await prisma.vaultItem.update({
      where: { id: itemId },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.content !== undefined ? { content: body.content } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
    });

    await prisma.vault.update({
      where: { id: vaultId },
      data: { updatedAt: new Date() },
    });

    res.json({
      data: serializeItem(item),
    } satisfies ApiResponse<VaultItem>);
  } catch (error) {
    next(error);
  }
});

router.delete("/:itemId", async (req, res, next) => {
  try {
    const vaultId = z.string().cuid().parse(req.params.vaultId);
    const itemId = z.string().cuid().parse(req.params.itemId);
    const vault = await getAccessibleVault(vaultId, req.user!);
    if (!canManageVault(req.user!, vault)) {
      throw new AppError(403, "Sem permissão para remover itens deste cofre");
    }

    const existing = await prisma.vaultItem.findFirst({
      where: { id: itemId, vaultId },
    });
    if (!existing) {
      throw new AppError(404, "Item não encontrado");
    }

    await prisma.vaultItem.delete({ where: { id: itemId } });
    await prisma.vault.update({
      where: { id: vaultId },
      data: { updatedAt: new Date() },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
