import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import type { ApiResponse, UserOption, UserPublic } from "@horizon/shared";
import {
  countUsersWithRoleSlug,
  createMemberUser,
  hashPassword,
  toUserPublic,
} from "../lib/auth";
import { AppError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";

const router = Router();

const userWithRoleInclude = {
  role: { select: { slug: true, name: true } },
} as const;

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(120),
  password: z.string().min(8).max(128),
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  password: z.string().min(8).max(128).optional(),
});

const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de cadastro. Tente novamente mais tarde." },
});

async function assertNotLastAdmin(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user) {
    throw new AppError(404, "Usuário não encontrado");
  }

  if (user.role.slug === "ADMIN") {
    const adminCount = await countUsersWithRoleSlug("ADMIN");
    if (adminCount <= 1) {
      throw new AppError(400, "Não é possível remover o último administrador");
    }
  }
}

router.get("/options", requireAuth, async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    res.json({
      data: users,
    } satisfies ApiResponse<UserOption[]>);
  } catch (error) {
    next(error);
  }
});

router.get("/", requireAuth, requirePermission("users:read"), async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: userWithRoleInclude,
    });
    const payload: ApiResponse<UserPublic[]> = {
      data: users.map(toUserPublic),
    };
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

/** Cadastro público — sempre MEMBER. Admin só via banco. */
router.post("/", createLimiter, async (req, res, next) => {
  try {
    const body = createUserSchema.parse(req.body);

    let user;
    try {
      user = await createMemberUser(body);
    } catch (error) {
      if (error instanceof Error && error.message === "EMAIL_TAKEN") {
        throw new AppError(409, "Email já cadastrado");
      }
      if (error instanceof Error && error.message === "MEMBER_ROLE_MISSING") {
        throw new AppError(500, "Papel MEMBER não configurado");
      }
      throw error;
    }

    res.status(201).json({
      data: toUserPublic(user),
    } satisfies ApiResponse<UserPublic>);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireAuth, requirePermission("users:update"), async (req, res, next) => {
  try {
    const id = z.string().cuid().parse(req.params.id);
    const body = updateUserSchema.parse(req.body);

    const data: {
      name?: string;
      passwordHash?: string;
    } = {};

    if (body.name) data.name = body.name;
    if (body.password) data.passwordHash = await hashPassword(body.password);

    const user = await prisma.user.update({
      where: { id },
      data,
      include: userWithRoleInclude,
    });

    res.json({
      data: toUserPublic(user),
    } satisfies ApiResponse<UserPublic>);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAuth, requirePermission("users:delete"), async (req, res, next) => {
  try {
    const id = z.string().cuid().parse(req.params.id);

    if (req.user?.id === id) {
      throw new AppError(400, "Você não pode remover a própria conta");
    }

    await assertNotLastAdmin(id);

    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
