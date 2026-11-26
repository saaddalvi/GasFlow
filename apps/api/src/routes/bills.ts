import { billSchema } from "@gasflow/shared";
import type { FastifyInstance } from "fastify";
import type { AppDependencies } from "../app";
import { getBill, noSuchBill } from "../services/bills";
import { idParam } from "./id-param";

export function billRoutes(app: FastifyInstance, { db }: AppDependencies): void {
  app.get("/api/bills/:billId", async (request) =>
    billSchema.parse(await getBill(db, idParam(request, "billId", noSuchBill))),
  );
}
