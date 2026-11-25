import type { Staff } from "@gasflow/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Database } from "./database";
import type { IdentityProvider } from "./identity";
import { recordStaff } from "./services/staff";

declare module "fastify" {
  interface FastifyRequest {
    /** Who is asking, taken from the session token and nothing else. */
    staff: Staff;
  }
}

/**
 * Refuses every request that lacks a valid session token, including requests for
 * paths that do not exist. The token is the only thing that says who is asking.
 */
export function requireSignIn(
  app: FastifyInstance,
  { db, identity }: { db: Database; identity: IdentityProvider },
): void {
  app.decorateRequest("staff");
  app.addHook("onRequest", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    const person = token ? await identity.verifyToken(token) : null;
    if (!person) {
      reply.header("WWW-Authenticate", "Bearer");
      return refuse(reply, 401, "Unauthorized", "Sign in to continue.");
    }
    request.staff = { ...(await recordStaff(db, person)), isAdmin: person.isAdmin };
  });
}

/**
 * The one way to limit an action to admins. Add it to the route:
 * `app.post(path, { onRequest: adminOnly }, handler)`.
 */
export async function adminOnly(request: FastifyRequest, reply: FastifyReply) {
  if (!request.staff.isAdmin) {
    return refuse(reply, 403, "Forbidden", "Only an admin can do this.");
  }
}

/** Answers in the same shape as Fastify's own errors. */
function refuse(reply: FastifyReply, statusCode: number, error: string, message: string) {
  return reply.code(statusCode).send({ statusCode, error, message });
}

function bearerToken(header: string | undefined): string | null {
  return /^Bearer +(\S+)$/i.exec(header ?? "")?.[1] ?? null;
}
