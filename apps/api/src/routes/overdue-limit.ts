import { newOverdueLimitSchema, overdueLimitSchema } from "@gasflow/shared";
import type { FastifyInstance } from "fastify";
import type { AppDependencies } from "../app";
import { adminOnly } from "../auth";
import { parseRequest } from "../refusal";
import { getOverdueLimit, setOverdueLimit } from "../services/overdue-limit";

/** Everyone reads the overdue limit; only an admin changes it. */
export function overdueLimitRoutes(app: FastifyInstance, { db }: AppDependencies): void {
  app.get("/api/overdue-limit", async () =>
    overdueLimitSchema.parse({ days: await getOverdueLimit(db) }),
  );

  app.put("/api/overdue-limit", { onRequest: adminOnly }, async (request) => {
    const { days } = parseRequest(newOverdueLimitSchema, request.body);
    await setOverdueLimit(db, days);
    return overdueLimitSchema.parse({ days });
  });
}
