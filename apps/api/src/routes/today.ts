import { todaySchema } from "@gasflow/shared";
import type { FastifyInstance } from "fastify";
import type { AppDependencies } from "../app";
import { today } from "../clock";

export function todayRoutes(app: FastifyInstance, { clock }: AppDependencies): void {
  app.get("/api/today", () => todaySchema.parse({ date: today(clock) }));
}
