"use server";

import { billSchema, type NewOpeningStock, type NewStartDate } from "@gasflow/shared";
import { sendChange, type Outcome } from "@/lib/api";

// What the Opening stock screen asks for. The API checks every value.

export async function setStartDate(startDate: NewStartDate): Promise<Outcome> {
  return sendChange("PUT", "/api/start-date", startDate);
}

export async function addOpeningStock(openingStock: NewOpeningStock): Promise<Outcome> {
  return sendChange("POST", "/api/opening-stock", openingStock, async (answer) => ({
    goTo: `/bills/${billSchema.parse(await answer.json()).id}`,
  }));
}
