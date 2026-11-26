import type { z } from "zod";

/** What came of checking something: what it holds, or what is wrong with it. */
export type Checked<T> = { data: T; problem?: undefined } | { data?: undefined; problem: string };

/**
 * Checks input against a schema, naming the first thing wrong in words fit to
 * show a person. Forms and the API both check this way, so they say the same.
 */
export function checkInput<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): Checked<z.output<Schema>> {
  const result = schema.safeParse(input ?? {});
  return result.success
    ? { data: result.data }
    : { problem: result.error.issues[0]?.message ?? "The request is not valid." };
}
