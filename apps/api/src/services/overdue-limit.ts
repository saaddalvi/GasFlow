import type { Database } from "../database";

/** The limit until an admin chooses another. */
const STARTING_LIMIT_DAYS = 30;

/**
 * The days out that cylinders must exceed to be overdue. One limit applies to
 * every customer.
 */
export async function getOverdueLimit(db: Database): Promise<number> {
  const chosen = await db.overdueLimit.findUnique({ where: { id: 1 }, select: { days: true } });
  return chosen?.days ?? STARTING_LIMIT_DAYS;
}

export async function setOverdueLimit(db: Database, days: number): Promise<void> {
  await db.overdueLimit.upsert({ where: { id: 1 }, create: { id: 1, days }, update: { days } });
}
