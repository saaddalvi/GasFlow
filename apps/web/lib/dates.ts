// Dates from the API are text such as "2026-11-26", with no time of day. They
// are read and written as UTC here, so that no time zone can move them.

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

/**
 * The last days of the months that have ended before today, newest first, from
 * the earliest date on and no more than asked for.
 */
export function monthEnds(earliest: string, today: string, most: number): string[] {
  const ends: string[] = [];
  // The day before the first of a month ends the month before it.
  let end = addDays(`${today.slice(0, 7)}-01`, -1);
  while (end >= earliest && ends.length < most) {
    ends.push(end);
    end = addDays(`${end.slice(0, 7)}-01`, -1);
  }
  return ends;
}
