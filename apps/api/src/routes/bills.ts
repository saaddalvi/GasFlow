import {
  billListQuerySchema,
  billListSchema,
  billNumberUseQuerySchema,
  billNumberUseSchema,
  billSchema,
  newDispatchSchema,
} from "@gasflow/shared";
import type { FastifyInstance } from "fastify";
import type { AppDependencies } from "../app";
import { parseRequest } from "../refusal";
import { findNumberUse, getBill, listBills, noSuchBill } from "../services/bills";
import { enterDispatch } from "../services/ledger";
import { idParam } from "./id-param";

/** Every staff member reads bills and enters those copied from the agency's paper. */
export function billRoutes(app: FastifyInstance, { db, clock }: AppDependencies): void {
  app.get("/api/bills", async (request) => {
    const query = parseRequest(billListQuerySchema, request.query);
    return billListSchema.parse(await listBills(db, query));
  });

  app.get("/api/bills/number-use", async (request) => {
    const query = parseRequest(billNumberUseQuerySchema, request.query);
    return billNumberUseSchema.parse(await findNumberUse(db, query));
  });

  app.post("/api/bills", async (request, reply) => {
    const dispatch = parseRequest(newDispatchSchema, request.body);
    const billId = await enterDispatch(db, clock, request.staff, dispatch);
    reply.code(201);
    return billSchema.parse(await getBill(db, billId));
  });

  app.get("/api/bills/:billId", async (request) =>
    billSchema.parse(await getBill(db, idParam(request, "billId", noSuchBill))),
  );
}
