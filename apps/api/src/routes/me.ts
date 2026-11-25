import { staffSchema } from "@gasflow/shared";
import type { FastifyInstance } from "fastify";

export function meRoutes(app: FastifyInstance): void {
  app.get("/api/me", (request) => staffSchema.parse(request.staff));
}
