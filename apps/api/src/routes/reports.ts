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
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AppDependencies } from "../app";
import type { DownloadedFile } from "../services/downloaded-file";
import { parseRequest } from "../refusal";
import { readBackup } from "../services/backup";
import { backupFile } from "../services/backup-file";
import { reportBalanceRegister } from "../services/balance-register";
import { reportDashboard } from "../services/dashboard";
import { reportDayLedger } from "../services/day-ledger";
import { reportParties } from "../services/party-report";
import { listPendingReturns } from "../services/pending";
import { getShop } from "../services/shop";
import { reportStockCard } from "../services/stock-card";
import { stockCardCsv } from "../services/stock-card-csv";
import { reportStock } from "../services/stock-report";

/** Answers with a file to save, under its name. */
function sendFile(reply: FastifyReply, type: string, { name, text }: DownloadedFile) {
  return reply
    .type(`${type}; charset=utf-8`)
    .header("content-disposition", `attachment; filename="${name}"`)
    .send(text);
}

/** Reports only read, and every staff member may see them. */
export function reportRoutes(app: FastifyInstance, { db, clock }: AppDependencies): void {
  app.get("/api/dashboard", async () => dashboardSchema.parse(await reportDashboard(db, clock)));

  app.get("/api/reports/party-balance", async (request) => {
    const query = parseRequest(balanceRegisterQuerySchema, request.query);
    return balanceRegisterSchema.parse(await reportBalanceRegister(db, clock, query));
  });

  app.get("/api/backup", async (_request, reply) =>
    sendFile(reply, "text/html", backupFile(await readBackup(db, clock))),
  );

  /** The stock card a request asks for, on screen or as a file. */
  const readStockCard = async (request: FastifyRequest) => {
    const query = parseRequest(stockCardQuerySchema, request.query);
    return stockCardSchema.parse(await reportStockCard(db, clock, query));
  };

  app.get("/api/reports/holdings", readStockCard);

  app.get("/api/reports/holdings.csv", async (request, reply) => {
    const [shop, card] = await Promise.all([getShop(db), readStockCard(request)]);
    return sendFile(reply, "text/csv", stockCardCsv(shop, card));
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
