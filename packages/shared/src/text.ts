import { z } from "zod";

/**
 * Text as it is kept: without spaces around it, and without the null character,
 * which the database refuses.
 */
export function text(notText: string) {
  return z
    .string(notText)
    .trim()
    .refine((value) => !value.includes("\0"), "Remove the characters that cannot be saved.");
}

/** Text that has to be filled in. */
export function requiredText({ missing, max, tooLong }: Limits & { missing: string }) {
  return text(missing).min(1, missing).max(max, tooLong);
}

/** Text that may be left blank. Blank is kept as null. */
export function optionalText({ max, tooLong }: Limits) {
  return text("Enter text, or leave it blank.")
    .max(max, tooLong)
    .nullable()
    .transform((value) => value || null);
}

interface Limits {
  max: number;
  tooLong: string;
}
