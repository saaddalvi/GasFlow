import { z } from "zod";

/** A calendar date such as "2026-11-26", with no time of day. */
export const dateSchema = z.iso.date();

export const todaySchema = z.object({
  date: dateSchema,
});
