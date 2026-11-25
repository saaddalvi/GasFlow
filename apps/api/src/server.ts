import { buildApp } from "./app";
import { createClerkIdentityProvider } from "./clerk-identity";
import { systemClock } from "./clock";
import { loadConfig } from "./config";
import { createDatabase } from "./database";

const config = loadConfig();
const db = createDatabase(config.databaseUrl);
const identity = createClerkIdentityProvider(config.clerk);
const app = buildApp({ db, clock: systemClock, identity }, { logger: true });
app.addHook("onClose", () => db.$disconnect());

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void app.close());
}

await app.listen({ host: config.host, port: config.port });
