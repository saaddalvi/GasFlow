import { today, type Clock } from "../clock";
import { fromDatabaseDate, toDatabaseDate } from "../database-date";
import type { Database, Transaction } from "../database";
import { Refusal } from "../refusal";

/** The date from which the records begin, or null until it has been set. */
export async function getStartDate(db: Database | Transaction): Promise<string | null> {
  const setup = await db.setup.findUnique({ where: { id: 1 }, select: { startDate: true } });
  return setup ? fromDatabaseDate(setup.startDate) : null;
}

/** Sets the start date, which is done once. */
export async function setStartDate(db: Database, clock: Clock, date: string): Promise<void> {
  // Cylinders cannot be counted as they stood on a day that has not come.
  if (date > today(clock)) {
    throw new Refusal(400, "The start date cannot be after today.");
  }
  // The one row there can be, so that of two saves at once only one is kept.
  const { count } = await db.setup.createMany({
    data: [{ startDate: toDatabaseDate(date) }],
    skipDuplicates: true,
  });
  if (count === 0) {
    throw new Refusal(409, "The start date has already been set.");
  }
}
