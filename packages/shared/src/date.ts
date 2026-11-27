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

const DAY = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const MOMENT = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

/** A date for people to read, such as "26 Nov 2026". */
export function formatDate(date: string): string {
  // Read and written as UTC, so that no time zone can move it.
  return DAY.format(new Date(date));
}

/** A moment for people to read, in Indian Standard Time. */
export function formatMoment(moment: string): string {
  return MOMENT.format(new Date(moment));
}

/** The date this many days later, or earlier if the number is negative. */
export function addDays(date: string, days: number): string {
  const moved = new Date(date);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

/** The last day of the month the date is in. */
export function lastOfMonth(date: string): string {
  const [year, month] = date.split("-").map(Number) as [number, number];
  // Day 0 of the month after is this month's last.
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/** Each month from the first date's to the last's, such as "2026-11", if they are in order. */
export function monthsBetween(from: string, to: string): string[] {
  if (from > to) {
    return [];
  }
  const months: string[] = [];
  const moment = new Date(firstOfMonth(from));
  while (moment.toISOString().slice(0, 7) <= to.slice(0, 7)) {
    months.push(moment.toISOString().slice(0, 7));
    moment.setUTCMonth(moment.getUTCMonth() + 1);
  }
  return months;
}

/** The days from one date to another, fewer than none if the other is earlier. */
export function daysBetween(from: string, to: string): number {
  // Both are midnight UTC, so the difference is whole days.
  return (Date.parse(to) - Date.parse(from)) / 86_400_000;
}

/** The first day of the financial year the date is in, which begins on 1 April. */
export function financialYearStart(date: string): string {
  const year = Number(date.slice(0, 4));
  return `${date.slice(5, 7) >= "04" ? year : year - 1}-04-01`;
}

export const todaySchema = z.object({
  date: dateSchema,
});
