import { z } from "zod";

// What an address's query string can hold. A form leaves a blank value for
// whatever was not chosen, which is the same as leaving it out.

/** A choice that narrows a list. */
export function optionalChoice<Schema extends z.ZodType>(schema: Schema) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
}

/** A "true" or "false" that is off unless asked for. */
export const queryFlag = optionalChoice(z.stringbool("Use true or false.")).transform(
  (value) => value ?? false,
);

const NO_SUCH_PAGE = "There is no such page.";

/** Which page of a long list, counted from 1. */
export const queryPage = z.coerce
  .number(NO_SUCH_PAGE)
  .int(NO_SUCH_PAGE)
  .min(1, NO_SUCH_PAGE)
  .max(1_000_000, NO_SUCH_PAGE)
  .default(1);
