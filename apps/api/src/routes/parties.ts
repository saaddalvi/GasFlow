import {
  newPartySchema,
  partyChangesSchema,
  partyListQuerySchema,
  partyListSchema,
  partySchema,
} from "@gasflow/shared";
import type { FastifyInstance } from "fastify";
import type { AppDependencies } from "../app";
import { parseRequest } from "../refusal";
import { changeParty, createParty, getParty, listParties, noSuchParty } from "../services/parties";
import { idParam } from "./id-param";

export function partyRoutes(app: FastifyInstance, { db }: AppDependencies): void {
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

  app.patch("/api/parties/:partyId", async (request) => {
    const partyId = idParam(request, "partyId", noSuchParty);
    const changes = parseRequest(partyChangesSchema, request.body);
    return partySchema.parse(await changeParty(db, partyId, changes));
  });
}
