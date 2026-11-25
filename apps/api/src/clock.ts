/** The only source of the current time, so that tests can choose it. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

// Indian Standard Time is UTC+05:30 all year; India has no daylight saving.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Today's date in India, as "YYYY-MM-DD". Everything that depends on "today"
 * uses this, wherever the server happens to run.
 */
export function today(clock: Clock): string {
  return new Date(clock.now().getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}
