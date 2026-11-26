import Fastify, { type FastifyServerOptions } from "fastify";
import { requireSignIn } from "./auth";
import type { Clock } from "./clock";
import type { Database } from "./database";
import type { IdentityProvider } from "./identity";
import { BlockedRefusal } from "./refusal";
import { billRoutes } from "./routes/bills";
import { gasRoutes } from "./routes/gases";
import { meRoutes } from "./routes/me";
import { openingStockRoutes } from "./routes/opening-stock";
import { partyRoutes } from "./routes/parties";
import { reportRoutes } from "./routes/reports";
import { returnRoutes } from "./routes/returns";
import { setupRoutes } from "./routes/setup";
import { shopRoutes } from "./routes/shop";
import { staffRoutes } from "./routes/staff";
import { todayRoutes } from "./routes/today";
import { vehicleRoutes } from "./routes/vehicles";

/** Everything the app reaches outside itself, so that tests can supply their own. */
export interface AppDependencies {
  db: Database;
  clock: Clock;
  identity: IdentityProvider;
}

export function buildApp(dependencies: AppDependencies, options: FastifyServerOptions = {}) {
  const app = Fastify(options);
  // The usual answer to an error says why, but leaves out which bills are to blame.
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof BlockedRefusal) {
      const { message, blockingBills } = error;
      return reply.code(error.statusCode).send({ message, blockingBills });
    }
    // Answered as usual.
    return reply.send(error);
  });
  requireSignIn(app, dependencies);
  billRoutes(app, dependencies);
  gasRoutes(app, dependencies);
  meRoutes(app);
  openingStockRoutes(app, dependencies);
  partyRoutes(app, dependencies);
  reportRoutes(app, dependencies);
  returnRoutes(app, dependencies);
  setupRoutes(app, dependencies);
  shopRoutes(app, dependencies);
  staffRoutes(app, dependencies);
  todayRoutes(app, dependencies);
  vehicleRoutes(app, dependencies);
  return app;
}
