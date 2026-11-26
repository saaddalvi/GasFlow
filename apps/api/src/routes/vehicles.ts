import {
  newVehicleSchema,
  vehicleChangesSchema,
  vehicleListQuerySchema,
  vehicleListSchema,
  vehicleSchema,
} from "@gasflow/shared";
import type { FastifyInstance } from "fastify";
import type { AppDependencies } from "../app";
import { parseRequest } from "../refusal";
import { changeVehicle, createVehicle, listVehicles, noSuchVehicle } from "../services/vehicles";
import { idParam } from "./id-param";

export function vehicleRoutes(app: FastifyInstance, { db }: AppDependencies): void {
  app.get("/api/vehicles", async (request) => {
    const query = parseRequest(vehicleListQuerySchema, request.query);
    return vehicleListSchema.parse({ vehicles: await listVehicles(db, query) });
  });

  app.post("/api/vehicles", async (request, reply) => {
    const vehicle = parseRequest(newVehicleSchema, request.body);
    reply.code(201);
    return vehicleSchema.parse(await createVehicle(db, vehicle));
  });

  app.patch("/api/vehicles/:vehicleId", async (request) => {
    const vehicleId = idParam(request, "vehicleId", noSuchVehicle);
    const changes = parseRequest(vehicleChangesSchema, request.body);
    return vehicleSchema.parse(await changeVehicle(db, vehicleId, changes));
  });
}
