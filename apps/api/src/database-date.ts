// The database keeps a calendar date without a time. Prisma hands one over as
// midnight UTC, while everywhere else a date is text such as "2026-11-26".

export function toDatabaseDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function fromDatabaseDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
