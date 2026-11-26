import { newStartDateSchema, startDateSchema } from "@gasflow/shared";
import type { FastifyInstance } from "fastify";
import type { AppDependencies } from "../app";
import { adminOnly } from "../auth";
import { parseRequest } from "../refusal";
import { getStartDate, setStartDate } from "../services/setup";

/** Everyone reads the start date; an admin sets it once. */
export function setupRoutes(app: FastifyInstance, { db, clock }: AppDependencies): void {
  app.get("/api/start-date", async () =>
    startDateSchema.parse({ startDate: await getStartDate(db) }),
  );

  app.put("/api/start-date", { onRequest: adminOnly }, async (request) => {
    const { date } = parseRequest(newStartDateSchema, request.body);
    await setStartDate(db, clock, date);
    return startDateSchema.parse({ startDate: date });
  });
}
