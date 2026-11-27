import { z } from "zod";
import { dateSchema } from "./date";
import { fillStateSchema } from "./bill";
import { gasSchema } from "./gas";
import { queryDate } from "./query";

export const dayLedgerQuerySchema = z.object({
  /** The day to report. Left out, it is today. */
  date: queryDate,
});

export type DayLedgerQuery = z.infer<typeof dayLedgerQuerySchema>;

/** The shop's cylinders over one day. */
export const dayLedgerCountsSchema = z.object({
  /** At the shop as the day began. Below zero when bills are missing or wrong. */
  opening: z.int(),
  /** Brought to the shop by the day's bills. */
  in: z.int(),
  /** Taken from the shop by the day's bills. */
  out: z.int(),
  /** At the shop as the day ended: the opening, plus in, less out. */
  closing: z.int(),
});

export type DayLedgerCounts = z.infer<typeof dayLedgerCountsSchema>;

export const dayLedgerTableSchema = z.object({
  fillState: fillStateSchema,
  gases: z.array(dayLedgerCountsSchema.extend({ gas: gasSchema.pick({ id: true, name: true }) })),
  /** All the gases together. */
  total: dayLedgerCountsSchema,
});

export type DayLedgerTable = z.infer<typeof dayLedgerTableSchema>;

export const dayLedgerSchema = z.object({
  date: dateSchema,
  startDate: dateSchema.nullable(),
  /** One for each fill state. Empty before the start date, when there are no records. */
  tables: z.array(dayLedgerTableSchema),
});

export type DayLedger = z.infer<typeof dayLedgerSchema>;
