import {
  partyListQuerySchema,
  partyReportSchema,
  pendingReturnListQuerySchema,
  pendingReturnListSchema,
  stockReportQuerySchema,
  stockReportSchema,
} from "@gasflow/shared";
import type { FastifyInstance } from "fastify";
import type { AppDependencies } from "../app";
import { parseRequest } from "../refusal";
import { reportParties } from "../services/party-report";
import { listPendingReturns } from "../services/pending";
import { reportStock } from "../services/stock-report";

/** Reports only read, and every staff member may see them. */
export function reportRoutes(app: FastifyInstance, { db, clock }: AppDependencies): void {
  app.get("/api/reports/parties", async (request) => {
    const query = parseRequest(partyListQuerySchema, request.query);
    return partyReportSchema.parse(await reportParties(db, query));
  });

  app.get("/api/reports/pending-returns", async (request) => {
    const query = parseRequest(pendingReturnListQuerySchema, request.query);
    return pendingReturnListSchema.parse(await listPendingReturns(db, clock, query));
  });

  app.get("/api/reports/stock", async (request) => {
    const { date } = parseRequest(stockReportQuerySchema, request.query);
    return stockReportSchema.parse(await reportStock(db, clock, date));
  });
}
