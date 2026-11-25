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

/** What the request holds, once it matches the schema. Otherwise a refusal. */
export function parseRequest<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.output<Schema> {
  const result = schema.safeParse(input ?? {});
  if (!result.success) {
    throw new Refusal(400, result.error.issues[0]?.message ?? "The request is not valid.");
  }
  return result.data;
}
