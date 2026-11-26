import {
  gasChangesSchema,
  gasListQuerySchema,
  gasListSchema,
  gasSchema,
  newGasSchema,
} from "@gasflow/shared";
import type { FastifyInstance } from "fastify";
import type { AppDependencies } from "../app";
import { adminOnly } from "../auth";
import { parseRequest } from "../refusal";
import { changeGas, createGas, listGases, noSuchGas } from "../services/gases";
import { idParam } from "./id-param";

/** Everyone reads the gas list; only admins change it. */
export function gasRoutes(app: FastifyInstance, { db }: AppDependencies): void {
  const admin = { onRequest: adminOnly };

  app.get("/api/gases", async (request) => {
    const query = parseRequest(gasListQuerySchema, request.query);
    return gasListSchema.parse({ gases: await listGases(db, query) });
  });

  app.post("/api/gases", admin, async (request, reply) => {
    const gas = parseRequest(newGasSchema, request.body);
    reply.code(201);
    return gasSchema.parse(await createGas(db, gas));
  });

  app.patch("/api/gases/:gasId", admin, async (request) => {
    const gasId = idParam(request, "gasId", noSuchGas);
    const changes = parseRequest(gasChangesSchema, request.body);
    return gasSchema.parse(await changeGas(db, gasId, changes));
  });
}
