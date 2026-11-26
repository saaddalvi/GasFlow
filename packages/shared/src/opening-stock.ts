import { z } from "zod";
import { billPartySchema, billStaffSchema, newBillLinesSchema } from "./bill";
import { dateSchema } from "./date";
import { queryPage } from "./query";

/**
 * A party's count on the start date. The app gives it its date and number, so
 * neither is asked for.
 */
export const newOpeningStockSchema = z.object({
  partyId: z.uuid("Choose a party."),
  lines: newBillLinesSchema,
});

export type NewOpeningStock = z.infer<typeof newOpeningStockSchema>;

export const openingStockListQuerySchema = z.object({
  page: queryPage,
});

export type OpeningStockListQuery = z.infer<typeof openingStockListQuerySchema>;

/** One page of the parties' opening stock, by party name. */
export const openingStockListSchema = z.object({
  entries: z.array(
    z.object({
      id: z.uuid(),
      number: z.string().min(1),
      date: dateSchema,
      party: billPartySchema,
      /** Cylinders on all its lines together. */
      quantity: z.int().positive(),
      enteredBy: billStaffSchema,
      enteredAt: z.iso.datetime(),
    }),
  ),
  /** How many entries there are, on every page together. */
  total: z.int().nonnegative(),
  page: z.int().positive(),
  pageSize: z.int().positive(),
});

export type OpeningStockList = z.infer<typeof openingStockListSchema>;

/** The parties whose opening stock can still be entered, the shop first. */
export const openingStockPartiesSchema = z.object({
  parties: z.array(billPartySchema),
});

export type OpeningStockParties = z.infer<typeof openingStockPartiesSchema>;
