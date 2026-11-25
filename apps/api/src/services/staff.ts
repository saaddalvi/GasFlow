import type { NewStaff, Staff, StaffMember } from "@gasflow/shared";
import type { Database } from "../database";
import type { Account, Identity, IdentityProvider } from "../identity";
import { Refusal } from "../refusal";

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

/**
 * Everyone who has a staff record or an account, those who can still get in
 * first, each group by name.
 */
export async function listStaff(db: Database, identity: IdentityProvider): Promise<StaffMember[]> {
  const accounts = await identity.listAccounts();
  // Someone added outside the app has no record until now.
  await Promise.all(accounts.map((account) => recordStaff(db, account)));
  const records = await db.staff.findMany({
    select: { id: true, identityId: true, displayName: true },
  });
  const accountsById = new Map(accounts.map((account) => [account.identityId, account]));
  return records
    .map(({ identityId, ...record }) => staffMember(record, accountsById.get(identityId) ?? null))
    .sort(
      (a, b) =>
        Number(!a.account) - Number(!b.account) || a.displayName.localeCompare(b.displayName),
    );
}

/** Gives a new person an account, and the staff record that will outlive it. */
export async function createStaff(
  db: Database,
  identity: IdentityProvider,
  newStaff: NewStaff,
): Promise<StaffMember> {
  const account = await identity.createAccount(newStaff);
  return staffMember(await recordStaff(db, account), account);
}

export async function resetStaffPassword(
  db: Database,
  identity: IdentityProvider,
  staffId: string,
  password: string,
): Promise<void> {
  const { identityId } = await findStaffWithAccess(db, identity, staffId);
  await identity.resetPassword(identityId, password);
}

/** Takes away a person's way in. Their staff record and name stay. */
export async function removeStaffAccess(
  db: Database,
  identity: IdentityProvider,
  actor: Staff,
  staffId: string,
): Promise<void> {
  const record = await findStaff(db, staffId);
  // So that an admin cannot lock the agency out by mistake.
  if (record.id === actor.id) {
    throw new Refusal(409, "You cannot remove your own access. Ask another admin to do it.");
  }
  await identity.removeAccess(record.identityId);
}

/** Gives the admin role, or changes the recovery email of someone who has it. */
export async function makeStaffAdmin(
  db: Database,
  identity: IdentityProvider,
  staffId: string,
  recoveryEmail: string,
): Promise<void> {
  const { identityId } = await findStaffWithAccess(db, identity, staffId);
  await identity.grantAdmin(identityId, recoveryEmail);
}

export async function removeStaffAdminRole(
  db: Database,
  identity: IdentityProvider,
  actor: Staff,
  staffId: string,
): Promise<void> {
  const { id, identityId } = await findStaffWithAccess(db, identity, staffId);
  // So that an admin cannot lock the agency out by mistake.
  if (id === actor.id) {
    throw new Refusal(409, "You cannot remove your own admin role. Ask another admin to do it.");
  }
  await identity.revokeAdmin(identityId);
}

async function findStaff(db: Database, staffId: string) {
  const record = await db.staff.findUnique({
    where: { id: staffId },
    select: { id: true, identityId: true },
  });
  if (!record) {
    throw noSuchStaff();
  }
  return record;
}

/** For changing an account, which someone who can no longer sign in does not have. */
async function findStaffWithAccess(db: Database, identity: IdentityProvider, staffId: string) {
  const record = await findStaff(db, staffId);
  if (!(await identity.findAccount(record.identityId))) {
    throw new Refusal(409, "This person's access has been removed.");
  }
  return record;
}

export function noSuchStaff(): Refusal {
  return new Refusal(404, "There is no such staff member.");
}

function staffMember(
  record: { id: string; displayName: string },
  account: Account | null,
): StaffMember {
  return {
    ...record,
    account: account && {
      username: account.username,
      isAdmin: account.isAdmin,
      recoveryEmail: account.recoveryEmail,
    },
  };
}
