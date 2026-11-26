"use server";

import { receivedReturnSchema, type NewReturn, type ReceivedReturn } from "@gasflow/shared";
import { sendChange, type Outcome } from "@/lib/api";

// What the Receive empties screen asks for. The API checks every value.

/** Saves what came back as one return, and gives what its confirmation names. */
export async function saveReturn(
  newReturn: NewReturn,
): Promise<Outcome & { received?: ReceivedReturn }> {
  let received: ReceivedReturn | undefined;
  const outcome = await sendChange("POST", "/api/returns", newReturn, async (answer) => {
    received = receivedReturnSchema.parse(await answer.json());
    return {};
  });
  return { ...outcome, received };
}
