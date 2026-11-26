import {
  billSchema,
  newOpeningStockSchema,
  openingStockListQuerySchema,
  openingStockListSchema,
  openingStockPartiesSchema,
} from "@gasflow/shared";
import type { FastifyInstance } from "fastify";
import type { AppDependencies } from "../app";
import { adminOnly } from "../auth";
import { parseRequest } from "../refusal";
import { getBill, listOpeningStock, listOpeningStockParties } from "../services/bills";
import { enterOpeningStock } from "../services/ledger";

/** Everyone reads opening stock; only admins enter it. */
export function openingStockRoutes(app: FastifyInstance, { db, clock }: AppDependencies): void {
  const admin = { onRequest: adminOnly };

  app.get("/api/opening-stock", async (request) => {
    const query = parseRequest(openingStockListQuerySchema, request.query);
    return openingStockListSchema.parse(await listOpeningStock(db, query));
  });

  // What the entry form offers.
  app.get("/api/opening-stock/parties", admin, async () =>
    openingStockPartiesSchema.parse({ parties: await listOpeningStockParties(db) }),
  );

  app.post("/api/opening-stock", admin, async (request, reply) => {
    const openingStock = parseRequest(newOpeningStockSchema, request.body);
    const billId = await enterOpeningStock(db, clock, request.staff, openingStock);
    reply.code(201);
    return billSchema.parse(await getBill(db, billId));
  });
}
