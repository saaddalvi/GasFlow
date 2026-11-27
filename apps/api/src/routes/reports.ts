import {
  balanceRegisterQuerySchema,
  balanceRegisterSchema,
  dashboardSchema,
  dayLedgerQuerySchema,
  dayLedgerSchema,
  partyListQuerySchema,
  partyReportSchema,
  pendingReturnListQuerySchema,
  pendingReturnListSchema,
  stockReportQuerySchema,
  stockCardQuerySchema,
  stockCardSchema,
  stockReportSchema,
} from "@gasflow/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AppDependencies } from "../app";
import { parseRequest } from "../refusal";
import { reportBalanceRegister } from "../services/balance-register";
import { reportDashboard } from "../services/dashboard";
import { reportDayLedger } from "../services/day-ledger";
import { reportParties } from "../services/party-report";
import { listPendingReturns } from "../services/pending";
import { getShop } from "../services/shop";
import { reportStockCard } from "../services/stock-card";
import { stockCardCsv } from "../services/stock-card-csv";
import { reportStock } from "../services/stock-report";

/** Reports only read, and every staff member may see them. */
export function reportRoutes(app: FastifyInstance, { db, clock }: AppDependencies): void {
  app.get("/api/dashboard", async () => dashboardSchema.parse(await reportDashboard(db, clock)));

  app.get("/api/reports/party-balance", async (request) => {
    const query = parseRequest(balanceRegisterQuerySchema, request.query);
    return balanceRegisterSchema.parse(await reportBalanceRegister(db, clock, query));
  });

  /** The stock card a request asks for, on screen or as a file. */
  const readStockCard = async (request: FastifyRequest) => {
    const query = parseRequest(stockCardQuerySchema, request.query);
    return stockCardSchema.parse(await reportStockCard(db, clock, query));
  };

  app.get("/api/reports/holdings", readStockCard);

  app.get("/api/reports/holdings.csv", async (request, reply) => {
    const [shop, card] = await Promise.all([getShop(db), readStockCard(request)]);
    const { name, text } = stockCardCsv(shop.name, card);
    return reply
      .type("text/csv; charset=utf-8")
      .header("content-disposition", `attachment; filename="${name}"`)
      .send(text);
  });

  app.get("/api/reports/ledger", async (request) => {
    const { date } = parseRequest(dayLedgerQuerySchema, request.query);
    return dayLedgerSchema.parse(await reportDayLedger(db, clock, date));
  });

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
