import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "./generated/prisma/client";

export type Database = PrismaClient;

/** The database as it is inside one transaction. */
export type Transaction = Prisma.TransactionClient;

export function createDatabase(url: string): Database {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

/** Whether a save was refused because it would repeat something that must be unique. */
export function isRepeat(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Matches text that has this in it, in any capitals. */
export function containing(text: string) {
  // As itself in a LIKE pattern, which Prisma leaves to its caller.
  return { contains: text.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" as const };
}
