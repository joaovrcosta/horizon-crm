import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import type { ApiResponse, UserOption, UserPublic } from "@horizon/shared";
import { hashPassword, toUserPublic } from "../lib/auth";
import { AppError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { requireAdmin, requireAuth } from "../middleware/auth";

const router = Router();

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(120),
  password: z.string().min(8).max(128),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  role: z.enum(["ADMIN", "MEMBER"]).optional(),
  password: z.string().min(8).max(128).optional(),
});

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

router.use(requireAuth, requireAdmin);

router.get("/", async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
    const payload: ApiResponse<UserPublic[]> = {
      data: users.map(toUserPublic),
    };
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = createUserSchema.parse(req.body);
    const email = body.email.toLowerCase();

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new AppError(409, "Email já cadastrado");
    }

    const user = await prisma.user.create({
      data: {
        email,
        name: body.name,
        role: body.role as Role,
        passwordHash: await hashPassword(body.password),
      },
    });

    res.status(201).json({
      data: toUserPublic(user),
    } satisfies ApiResponse<UserPublic>);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const id = z.string().cuid().parse(req.params.id);
    const body = updateUserSchema.parse(req.body);

    const data: {
      name?: string;
      role?: Role;
      passwordHash?: string;
    } = {};

    if (body.name) data.name = body.name;
    if (body.role) data.role = body.role as Role;
    if (body.password) data.passwordHash = await hashPassword(body.password);

    const user = await prisma.user.update({
      where: { id },
      data,
    });

    res.json({
      data: toUserPublic(user),
    } satisfies ApiResponse<UserPublic>);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = z.string().cuid().parse(req.params.id);

    if (req.user?.id === id) {
      throw new AppError(400, "Você não pode remover a própria conta");
    }

    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
