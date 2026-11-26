import {
  closedRowListQuerySchema,
  closedRowListSchema,
  newReturnSchema,
  pendingListSchema,
  pendingQuerySchema,
  receivedReturnSchema,
  returnCustomerListQuerySchema,
  returnCustomerListSchema,
} from "@gasflow/shared";
import type { FastifyInstance } from "fastify";
import type { AppDependencies } from "../app";
import { parseRequest } from "../refusal";
import { receiveReturn } from "../services/ledger";
import { listClosedRows, listPending, listReturnCustomers } from "../services/pending";

/** Every staff member receives empties. */
export function returnRoutes(app: FastifyInstance, { db, clock }: AppDependencies): void {
  app.get("/api/returns/customers", async (request) => {
    const query = parseRequest(returnCustomerListQuerySchema, request.query);
    return returnCustomerListSchema.parse(await listReturnCustomers(db, query));
  });

  app.get("/api/returns/closed", async (request) => {
    const query = parseRequest(closedRowListQuerySchema, request.query);
    return closedRowListSchema.parse(await listClosedRows(db, query));
  });

  app.get("/api/returns/pending", async (request) => {
    const query = parseRequest(pendingQuerySchema, request.query);
    return pendingListSchema.parse(await listPending(db, clock, query));
  });

  app.post("/api/returns", async (request, reply) => {
    const newReturn = parseRequest(newReturnSchema, request.body);
    const received = await receiveReturn(db, clock, request.staff, newReturn);
    reply.code(201);
    return receivedReturnSchema.parse(received);
  });
}
