import {
  billListQuerySchema,
  billListSchema,
  billNumberUseQuerySchema,
  billNumberUseSchema,
  billSchema,
  newBillSchema,
  newCancellationSchema,
  refillerRefillerSlipNumberUseQuerySchema,
} from "@gasflow/shared";
import type { FastifyInstance } from "fastify";
import type { AppDependencies } from "../app";
import { parseRequest } from "../refusal";
import {
  findNumberUse,
  findRefillerSlipNumberUse,
  getBill,
  listBills,
  noSuchBill,
} from "../services/bills";
import { cancelBill, enterBill } from "../services/ledger";
import { idParam } from "./id-param";

/** Every staff member reads bills and enters those copied from paper. */
export function billRoutes(app: FastifyInstance, { db, clock }: AppDependencies): void {
  app.get("/api/bills", async (request) => {
    const query = parseRequest(billListQuerySchema, request.query);
    return billListSchema.parse(await listBills(db, query));
  });

  app.get("/api/bills/number-use", async (request) => {
    const query = parseRequest(billNumberUseQuerySchema, request.query);
    return billNumberUseSchema.parse(await findNumberUse(db, query));
  });

  app.get("/api/bills/refiller-slip-number-use", async (request) => {
    const query = parseRequest(refillerRefillerSlipNumberUseQuerySchema, request.query);
    return billNumberUseSchema.parse(await findRefillerSlipNumberUse(db, query));
  });

  app.post("/api/bills", async (request, reply) => {
    const bill = parseRequest(newBillSchema, request.body);
    const billId = await enterBill(db, clock, request.staff, bill);
    reply.code(201);
    return billSchema.parse(await getBill(db, billId));
  });

  app.get("/api/bills/:billId", async (request) =>
    billSchema.parse(await getBill(db, idParam(request, "billId", noSuchBill))),
  );

  // Who may cancel which bill is the ledger's to say.
  app.post("/api/bills/:billId/cancel", async (request) => {
    const billId = idParam(request, "billId", noSuchBill);
    const cancellation = parseRequest(newCancellationSchema, request.body);
    await cancelBill(db, clock, request.staff, billId, cancellation);
    return billSchema.parse(await getBill(db, billId));
  });
}
