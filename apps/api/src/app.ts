import Fastify, { type FastifyServerOptions } from "fastify";
import type { Clock } from "./clock";
import type { Database } from "./database";
import type { IdentityProvider } from "./identity";
import { gasRoutes } from "./routes/gases";
import { shopRoutes } from "./routes/shop";
import { todayRoutes } from "./routes/today";

/** Everything the app reaches outside itself, so that tests can supply their own. */
export interface AppDependencies {
  db: Database;
  clock: Clock;
  identity: IdentityProvider;
}

export function buildApp(dependencies: AppDependencies, options: FastifyServerOptions = {}) {
  const app = Fastify(options);
  gasRoutes(app, dependencies);
  shopRoutes(app, dependencies);
  todayRoutes(app, dependencies);
  return app;
}
