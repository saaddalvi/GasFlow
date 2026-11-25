import type { Clock } from "../../src/clock";

/** A clock that stands still until a test moves it. */
export class TestClock implements Clock {
  private instant = new Date("2026-11-26T06:30:00.000Z"); // noon in India

  now(): Date {
    return new Date(this.instant);
  }

  set(instant: string): void {
    const next = new Date(instant);
    if (Number.isNaN(next.getTime())) {
      throw new Error(`Not a date and time: ${instant}`);
    }
    this.instant = next;
  }
}
