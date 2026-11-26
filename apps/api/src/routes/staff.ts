import {
  adminRoleSchema,
  newPasswordSchema,
  newStaffSchema,
  staffListSchema,
  staffMemberSchema,
} from "@gasflow/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AppDependencies } from "../app";
import { adminOnly } from "../auth";
import { parseRequest } from "../refusal";
import {
  createStaff,
  listStaff,
  makeStaffAdmin,
  noSuchStaff,
  removeStaffAccess,
  removeStaffAdminRole,
  resetStaffPassword,
} from "../services/staff";
import { idParam } from "./id-param";

/** What an admin does on the Staff screen. */
export function staffRoutes(app: FastifyInstance, { db, identity }: AppDependencies): void {
  const admin = { onRequest: adminOnly };

  app.get("/api/staff", admin, async () =>
    staffListSchema.parse({ staff: await listStaff(db, identity) }),
  );

  app.post("/api/staff", admin, async (request, reply) => {
    const newStaff = parseRequest(newStaffSchema, request.body);
    reply.code(201);
    return staffMemberSchema.parse(await createStaff(db, identity, newStaff));
  });

  app.put("/api/staff/:staffId/password", admin, async (request, reply) => {
    const { password } = parseRequest(newPasswordSchema, request.body);
    await resetStaffPassword(db, identity, staffIdFrom(request), password);
    return reply.code(204).send();
  });

  app.delete("/api/staff/:staffId/access", admin, async (request, reply) => {
    await removeStaffAccess(db, identity, request.staff, staffIdFrom(request));
    return reply.code(204).send();
  });

  app.put("/api/staff/:staffId/admin", admin, async (request, reply) => {
    const { recoveryEmail } = parseRequest(adminRoleSchema, request.body);
    await makeStaffAdmin(db, identity, staffIdFrom(request), recoveryEmail);
    return reply.code(204).send();
  });

  app.delete("/api/staff/:staffId/admin", admin, async (request, reply) => {
    await removeStaffAdminRole(db, identity, request.staff, staffIdFrom(request));
    return reply.code(204).send();
  });
}

/** The staff member named in the address. */
function staffIdFrom(request: FastifyRequest): string {
  return idParam(request, "staffId", noSuchStaff);
}
