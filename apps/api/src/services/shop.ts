import type { Shop } from "@gasflow/shared";
import type { Database } from "../database";

export function getShop(db: Database): Promise<Shop> {
  return db.party.findFirstOrThrow({
    where: { type: "shop" },
    select: { id: true, name: true },
  });
}
