import { z } from "zod";
import { text } from "./text";

// What an address's query string can hold. A form leaves a blank value for
// whatever was not chosen, which is the same as leaving it out.

/** A choice that narrows a list. */
export function optionalChoice<Schema extends z.ZodType>(schema: Schema) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
}

/** Part of some text to look for, in any capitals. */
export const querySearch = text("Search for one thing at a time.")
  .optional()
  .transform((value) => value || undefined);

const NO_SUCH_DATE = "Choose a date.";

/** A date that narrows a list. */
export const queryDate = optionalChoice(
  z.iso
    .date(NO_SUCH_DATE)
    // The database has no year 0.
    .refine((date) => !date.startsWith("0000"), NO_SUCH_DATE),
);

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
