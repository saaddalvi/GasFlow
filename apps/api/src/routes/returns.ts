import {
  closedRowListQuerySchema,
  closedRowListSchema,
  matchedSchema,
  newMatchSchema,
  splitQuerySchema,
  splitSchema,
  newReturnSchema,
  pendingListSchema,
  pendingQuerySchema,
  receivedReturnSchema,
  returnCustomerListQuerySchema,
  returnCustomerListSchema,
  unmatchedListQuerySchema,
  unmatchedListSchema,
} from "@gasflow/shared";
import type { FastifyInstance } from "fastify";
import type { AppDependencies } from "../app";
import { parseRequest } from "../refusal";
import { matchUnmatched, receiveReturn } from "../services/ledger";
import {
  listClosedRows,
  listPending,
  listReturnCustomers,
  proposeSplit,
} from "../services/pending";
import { listUnmatched, noSuchReturn } from "../services/unmatched";
import { idParam } from "./id-param";

/** Every staff member receives empties, and matches those left unmatched. */
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

  // Saves nothing: staff see the split and may change it before saving.
  app.get("/api/returns/split", async (request) => {
    const query = parseRequest(splitQuerySchema, request.query);
    return splitSchema.parse(await proposeSplit(db, clock, query));
  });

  app.get("/api/returns/unmatched", async (request) => {
    const query = parseRequest(unmatchedListQuerySchema, request.query);
    return unmatchedListSchema.parse(await listUnmatched(db, query));
  });

  app.post("/api/returns", async (request, reply) => {
    const newReturn = parseRequest(newReturnSchema, request.body);
    const received = await receiveReturn(db, clock, request.staff, newReturn);
    reply.code(201);
    return receivedReturnSchema.parse(received);
  });

  app.post("/api/returns/:returnId/matches", async (request, reply) => {
    const returnId = idParam(request, "returnId", noSuchReturn);
    const match = parseRequest(newMatchSchema, request.body);
    const matched = await matchUnmatched(db, returnId, match);
    reply.code(201);
    return matchedSchema.parse(matched);
  });
}
