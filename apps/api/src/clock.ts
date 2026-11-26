import { indianDate } from "@gasflow/shared";

/** The only source of the current time, so that tests can choose it. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

/**
 * Today's date in India, as "YYYY-MM-DD". Everything that depends on "today"
 * uses this, wherever the server happens to run.
 */
export function today(clock: Clock): string {
  return indianDate(clock.now());
}
