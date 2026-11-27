import { z } from "zod";

/** A calendar date such as "2026-11-26", with no time of day. */
export const dateSchema = z.iso.date();

// Indian Standard Time is UTC+05:30 all year; India has no daylight saving.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** The date in India at this moment, as "YYYY-MM-DD", wherever this runs. */
export function indianDate(moment: Date): string {
  return new Date(moment.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The first moment of the date in India. */
export function indianDayStart(date: string): Date {
  return new Date(Date.parse(date) - IST_OFFSET_MS);
}

/** The first day of the month the date is in. */
export function firstOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** The date this many days later, or earlier if the number is negative. */
export function addDays(date: string, days: number): string {
  const moved = new Date(date);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

/** The first day of the financial year the date is in, which begins on 1 April. */
export function financialYearStart(date: string): string {
  const year = Number(date.slice(0, 4));
  return `${date.slice(5, 7) >= "04" ? year : year - 1}-04-01`;
}

export const todaySchema = z.object({
  date: dateSchema,
});
