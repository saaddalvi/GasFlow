import { z } from "zod";

/** A calendar date such as "2026-11-26", with no time of day. */
export const dateSchema = z.iso.date();

// Indian Standard Time is UTC+05:30 all year; India has no daylight saving.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** The date in India at this moment, as "YYYY-MM-DD", wherever this runs. */
export function indianDate(moment: Date): string {
  return new Date(moment.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export const todaySchema = z.object({
  date: dateSchema,
});
