import type { Database } from "../database";
import type { Identity } from "../identity";

/**
 * The person's local staff record, created on their first request and brought up
 * to date when their name changes.
 */
export async function recordStaff(db: Database, { identityId, displayName }: Identity) {
  const select = { id: true, displayName: true } as const;
  const existing = await db.staff.findUnique({ where: { identityId }, select });
  if (existing?.displayName === displayName) {
    return existing;
  }
  // An upsert, because several of a person's first requests can arrive at once.
  return db.staff.upsert({
    where: { identityId },
    create: { identityId, displayName },
    update: { displayName },
    select,
  });
}
