import { gasListSchema } from "@gasflow/shared";
import type { FastifyInstance } from "fastify";
import type { AppDependencies } from "../app";
import { listGases } from "../services/gases";

export function gasRoutes(app: FastifyInstance, { db }: AppDependencies): void {
  app.get("/api/gases", async () => gasListSchema.parse({ gases: await listGases(db) }));
}
