import type { Shop } from "@gasflow/shared";
import type { Database, Transaction } from "../database";

export function getShop(db: Database | Transaction): Promise<Shop> {
  return db.party.findFirstOrThrow({
    where: { type: "shop" },
    select: { id: true, name: true },
  });
}
