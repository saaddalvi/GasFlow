import {
  dailySummaryQuerySchema,
  dailySummarySchema,
  newPartySchema,
  partyChangesSchema,
  partyHoldingSchema,
  partyListQuerySchema,
  partyListSchema,
  partySchema,
} from "@gasflow/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AppDependencies } from "../app";
import { parseRequest } from "../refusal";
import { getPartyHolding, listMovementDays } from "../services/holdings";
import { changeParty, createParty, getParty, listParties, noSuchParty } from "../services/parties";
import { idParam } from "./id-param";

export function partyRoutes(app: FastifyInstance, { db, clock }: AppDependencies): void {
  app.get("/api/parties", async (request) => {
    const query = parseRequest(partyListQuerySchema, request.query);
    return partyListSchema.parse(await listParties(db, query));
  });

  app.post("/api/parties", async (request, reply) => {
    const party = parseRequest(newPartySchema, request.body);
    reply.code(201);
    return partySchema.parse(await createParty(db, party));
  });

  app.get("/api/parties/:partyId", async (request) =>
    partySchema.parse(await getParty(db, idParam(request, "partyId", noSuchParty))),
  );

  /** The party a request is about. The shop and unknown ids are turned away as on the party itself. */
  const findAskedParty = (request: FastifyRequest) =>
    getParty(db, idParam(request, "partyId", noSuchParty));

  app.get("/api/parties/:partyId/holding", async (request) => {
    const { id } = await findAskedParty(request);
    return partyHoldingSchema.parse(await getPartyHolding(db, clock, id));
  });

  app.get("/api/parties/:partyId/daily-summary", async (request) => {
    const query = parseRequest(dailySummaryQuerySchema, request.query);
    const { id } = await findAskedParty(request);
    return dailySummarySchema.parse(await listMovementDays(db, id, query));
  });

  app.patch("/api/parties/:partyId", async (request) => {
    const partyId = idParam(request, "partyId", noSuchParty);
    const changes = parseRequest(partyChangesSchema, request.body);
    return partySchema.parse(await changeParty(db, partyId, changes));
  });
}
