import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "./generated/prisma/client";

export type Database = PrismaClient;

/** The database as it is inside one transaction. */
export type Transaction = Prisma.TransactionClient;

export function createDatabase(url: string): Database {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}
