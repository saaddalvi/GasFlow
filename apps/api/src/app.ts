import Fastify, { type FastifyServerOptions } from "fastify";
import { requireSignIn } from "./auth";
import type { Clock } from "./clock";
import type { Database } from "./database";
import type { IdentityProvider } from "./identity";
import { gasRoutes } from "./routes/gases";
import { meRoutes } from "./routes/me";
import { partyRoutes } from "./routes/parties";
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
  requireSignIn(app, dependencies);
  gasRoutes(app, dependencies);
  meRoutes(app);
  partyRoutes(app, dependencies);
  shopRoutes(app, dependencies);
  staffRoutes(app, dependencies);
  todayRoutes(app, dependencies);
  vehicleRoutes(app, dependencies);
  return app;
}
