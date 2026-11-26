import { z } from "zod";
import { dateSchema } from "./date";
import { gasSchema } from "./gas";
import { optionalChoice } from "./query";

export const stockReportQuerySchema = z.object({
  /** The day to report as it ended. Left out, it is today. */
  date: optionalChoice(z.iso.date("Choose a date.")),
});

export type StockReportQuery = z.infer<typeof stockReportQuerySchema>;

/** A count of cylinders. It is negative when bills take away more than were there. */
const count = z.int();

export const stockReportRowSchema = z.object({
  gas: gasSchema.pick({ id: true, name: true }),
  shop: z.object({ filled: count, empty: count, defective: count }),
  /** Held by all customers together, whatever the fill state. */
  customers: count,
  /** Held by all refillers together, whatever the fill state. */
  refillers: count,
  /** The shop, customers and refillers together. */
  total: count,
});

export type StockReportRow = z.infer<typeof stockReportRowSchema>;

/** Where the cylinders were at the end of one day. */
export const stockReportSchema = z.object({
  date: dateSchema,
  startDate: dateSchema.nullable(),
  /** One for each gas. Empty before the start date, when there are no records. */
  rows: z.array(stockReportRowSchema),
});

export type StockReport = z.infer<typeof stockReportSchema>;
