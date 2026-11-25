import { shopSchema } from "@gasflow/shared";
import type { FastifyInstance } from "fastify";
import type { AppDependencies } from "../app";
import { getShop } from "../services/shop";

export function shopRoutes(app: FastifyInstance, { db }: AppDependencies): void {
  app.get("/api/shop", async () => shopSchema.parse(await getShop(db)));
}
