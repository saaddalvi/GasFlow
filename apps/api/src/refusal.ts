import { checkInput, type BlockingBill } from "@gasflow/shared";
import type { z } from "zod";

/**
 * A request that is turned down, with a reason fit to show the person who made
 * it. Throw it anywhere while handling a request; the answer carries the status
 * and the message.
 */
export class Refusal extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

/** A refusal because of other bills, which it names so that the person can go to them. */
export class BlockedRefusal extends Refusal {
  constructor(
    message: string,
    readonly blockingBills: BlockingBill[],
  ) {
    super(409, message);
  }
}

/** What the request holds, once it matches the schema. Otherwise a refusal. */
export function parseRequest<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.output<Schema> {
  const checked = checkInput(schema, input);
  if (checked.problem !== undefined) {
    throw new Refusal(400, checked.problem);
  }
  return checked.data;
}
