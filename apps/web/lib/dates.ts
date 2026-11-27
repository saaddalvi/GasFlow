import { addDays, firstOfMonth } from "@gasflow/shared";

export { formatDate, formatMoment } from "@gasflow/shared";

// Dates from the API are text such as "2026-11-26", with no time of day. They
// are read and written as UTC here, so that no time zone can move them.

const DAY_IN_FULL = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const MONTH = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const SHORT_DAY = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const WEEKDAY = new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "UTC" });

const SHORT_WEEKDAY = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" });

const TIME = new Intl.DateTimeFormat("en-IN", { timeStyle: "short", timeZone: "Asia/Kolkata" });

/** A date with its weekday, to check against paper, such as "Thursday, 26 November 2026". */
export function formatDateInFull(date: string): string {
  return DAY_IN_FULL.format(new Date(date));
}

/** The month a date is in, such as "November 2026". */
export function formatMonth(date: string): string {
  return MONTH.format(new Date(date));
}

/** A date whose year goes without saying, such as "26 Nov". */
export function formatDayAndMonth(date: string): string {
  return SHORT_DAY.format(new Date(date));
}

/** The weekday of a date, such as "Thursday". */
export function formatWeekday(date: string): string {
  return WEEKDAY.format(new Date(date));
}

/** The weekday of a date where there is little room, such as "Thu". */
export function formatShortWeekday(date: string): string {
  return SHORT_WEEKDAY.format(new Date(date));
}

/** The time of day of a moment, in Indian Standard Time. */
export function formatTime(moment: string): string {
  return TIME.format(new Date(moment));
}

/**
 * The last days of the months that have ended before today, newest first, from
 * the earliest date on and no more than asked for.
 */
export function monthEnds(earliest: string, today: string, most: number): string[] {
  const ends: string[] = [];
  // The day before the first of a month ends the month before it.
  let end = addDays(firstOfMonth(today), -1);
  while (end >= earliest && ends.length < most) {
    ends.push(end);
    end = addDays(firstOfMonth(end), -1);
  }
  return ends;
}
