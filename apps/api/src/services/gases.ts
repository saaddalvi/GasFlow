import type { Gas } from "@gasflow/shared";
import type { Database } from "../database";

export function listGases(db: Database): Promise<Gas[]> {
  return db.gas.findMany({
    select: { id: true, name: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}
