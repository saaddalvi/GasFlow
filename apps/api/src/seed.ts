import type { Database } from "./database";

export const SHOP_NAME = "GasFlow";

// The ids are fixed so that running the seed again skips a gas that is already
// there, even after an admin has renamed it. Never change or reuse an id.
const STARTING_GASES = [
  { id: "0b8f2c6e-1f4a-4d0b-9c55-000000000001", name: "Medical oxygen" },
  { id: "0b8f2c6e-1f4a-4d0b-9c55-000000000002", name: "Industrial oxygen" },
  { id: "0b8f2c6e-1f4a-4d0b-9c55-000000000003", name: "Carbon dioxide" },
  { id: "0b8f2c6e-1f4a-4d0b-9c55-000000000004", name: "Ammonia" },
  { id: "0b8f2c6e-1f4a-4d0b-9c55-000000000005", name: "Nitrogen" },
  { id: "0b8f2c6e-1f4a-4d0b-9c55-000000000006", name: "Argon" },
  { id: "0b8f2c6e-1f4a-4d0b-9c55-000000000007", name: "DA (dissolved acetylene)" },
  { id: "0b8f2c6e-1f4a-4d0b-9c55-000000000008", name: "Air" },
  { id: "0b8f2c6e-1f4a-4d0b-9c55-000000000009", name: "Hydrogen" },
  { id: "0b8f2c6e-1f4a-4d0b-9c55-000000000010", name: "Nitrous oxide" },
];

/** Creates the shop and the starting gases. Safe to run any number of times. */
export async function seedDatabase(db: Database): Promise<void> {
  await db.$transaction([
    db.party.createMany({
      data: [{ type: "shop", name: SHOP_NAME }],
      skipDuplicates: true,
    }),
    db.gas.createMany({
      data: STARTING_GASES.map((gas, index) => ({ ...gas, sortOrder: index + 1 })),
      skipDuplicates: true,
    }),
  ]);
}
