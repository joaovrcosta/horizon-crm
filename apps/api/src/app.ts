import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { ApiResponse } from "@horizon/shared";
import { createHealthStatus } from "@horizon/shared";
import { errorHandler } from "./middleware/error";
import activitiesRoutes from "./routes/activities";
import authRoutes from "./routes/auth";
import emailsRoutes from "./routes/emails";
import prospectsRoutes from "./routes/prospects";
import promptsRoutes from "./routes/prompts";
import settingsRoutes from "./routes/settings";
import statsRoutes from "./routes/stats";
import usersRoutes from "./routes/users";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    const payload: ApiResponse<ReturnType<typeof createHealthStatus>> = {
      data: createHealthStatus("horizon-api"),
    };
    res.json(payload);
  });

  app.use("/auth", authRoutes);
  app.use("/users", usersRoutes);
  app.use("/stats", statsRoutes);
  app.use("/settings", settingsRoutes);
  app.use("/prospects/:id/activities", activitiesRoutes);
  app.use("/prospects/:id/emails", emailsRoutes);
  app.use("/prospects", prospectsRoutes);
  app.use("/prompts", promptsRoutes);

  app.use(errorHandler);

  return app;
}
