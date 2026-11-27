import type { Gas, GasChanges, GasListQuery, NewGas } from "@gasflow/shared";
import { isRepeat, type Database, type Transaction } from "../database";
import { Refusal } from "../refusal";

/** Gases in the order they were added, the starting ones first. */
export function listGases(db: Database | Transaction, { retired }: GasListQuery): Promise<Gas[]> {
  return db.gas.findMany({
    where: { active: retired ? undefined : true },
    select: GAS,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

/** Adds a gas at the end of the list. */
export async function createGas(db: Database, { name }: NewGas): Promise<Gas> {
  const { _max } = await db.gas.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (_max.sortOrder ?? 0) + 1;
  return refusingTakenName(db.gas.create({ data: { name, sortOrder }, select: GAS }));
}

/** Changes what is mentioned. */
export async function changeGas(db: Database, gasId: string, changes: GasChanges): Promise<Gas> {
  // Gases are never deleted, so one that is found here is still there below.
  if (!(await db.gas.findUnique({ where: { id: gasId }, select: { id: true } }))) {
    throw noSuchGas();
  }
  return refusingTakenName(db.gas.update({ where: { id: gasId }, data: changes, select: GAS }));
}

export function noSuchGas(): Refusal {
  return new Refusal(404, "There is no such gas.");
}

/** The columns the API reports for a gas. */
const GAS = { id: true, name: true, active: true } as const;

/** The database keeps names apart, whatever their capitals, even between saves at once. */
async function refusingTakenName<T>(save: PromiseLike<T>): Promise<T> {
  try {
    return await save;
  } catch (error) {
    // A gas's name is the one unique thing a save can collide on.
    if (isRepeat(error)) {
      throw new Refusal(409, "There is already a gas with that name. It may be a retired one.");
    }
    throw error;
  }
}
