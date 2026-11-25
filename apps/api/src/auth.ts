import type { Staff } from "@gasflow/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Database } from "./database";
import type { IdentityProvider } from "./identity";
import { Refusal } from "./refusal";
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
      throw new Refusal(401, "Sign in to continue.");
    }
    request.staff = { ...(await recordStaff(db, person)), isAdmin: person.isAdmin };
  });
}

/**
 * The one way to limit an action to admins. Add it to the route:
 * `app.post(path, { onRequest: adminOnly }, handler)`.
 */
export function adminOnly(request: FastifyRequest, _reply: unknown, done: (error?: Error) => void) {
  done(request.staff.isAdmin ? undefined : new Refusal(403, "Only an admin can do this."));
}

function bearerToken(header: string | undefined): string | null {
  return /^Bearer +(\S+)$/i.exec(header ?? "")?.[1] ?? null;
}
