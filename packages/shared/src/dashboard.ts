import { z } from "zod";
import { dateSchema } from "./date";
import { gasHeldSchema } from "./holding";
import { stockReportRowSchema } from "./stock-report";

/** What was dispatched on one day. */
const dispatchedDaySchema = z.object({ date: dateSchema, quantity: z.int().nonnegative() });

export type DispatchedDay = z.infer<typeof dispatchedDaySchema>;

/** What was dispatched on the dates, both ends included. */
const dispatchedRangeSchema = z.object({
  from: dateSchema,
  to: dateSchema,
  quantity: z.int().nonnegative(),
});

/** What all the customers hold, or all the refillers, and how many of them hold any. */
const heldOutsideSchema = z.object({
  /** Of every gas together, so counts below zero take from it. */
  held: z.int(),
  /** How many hold some of any gas, or fewer than none. */
  parties: z.int().nonnegative(),
});

const countedGases = {
  quantity: z.int().nonnegative(),
  /** One for each gas that moved. */
  gases: z.array(gasHeldSchema),
};

/** Today's activity and where the cylinders are, as the dashboard shows them. */
export const dashboardSchema = z.object({
  /** Today's date in India. */
  date: dateSchema,
  startDate: dateSchema.nullable(),
  /** What posted dispatch bills dated today sent to customers. */
  dispatched: z.object({
    ...countedGases,
    /** How many customers were sent any. */
    customers: z.int().nonnegative(),
    /** The same weekday a week ago. */
    lastWeek: dispatchedDaySchema,
    /** The last seven days, today last. */
    days: z.array(dispatchedDaySchema).length(7),
    /** From the first of this month to today. */
    thisMonth: dispatchedRangeSchema,
    /** Last month up to the same day, or all of it if it has no such day. */
    lastMonth: dispatchedRangeSchema,
  }),
  /** What posted returns dated today brought back from customers, matched or not. */
  received: z.object(countedGases),
  /** What was dispatched today less what was received, so below zero when more came back. */
  netOut: z.int(),
  /** The posted bills entered today in India, whatever their dates. */
  billsEntered: z.object({
    count: z.int().nonnegative(),
    /** When the last of them was entered, or null if there are none. */
    lastEnteredAt: z.iso.datetime().nullable(),
  }),
  /** Today's sends to refillers and returns from them. */
  refillerMovements: z.object({
    sent: z.int().nonnegative(),
    received: z.int().nonnegative(),
  }),
  /** Where the cylinders are as of today. */
  cylinders: z.object({
    /** At the shop, with customers and at refillers together. */
    total: z.int(),
    shop: stockReportRowSchema.shape.shop.extend({ total: z.int() }),
    customers: heldOutsideSchema,
    refillers: heldOutsideSchema,
    /** The same gas by gas, as the stock report for today has it. */
    gases: z.array(stockReportRowSchema),
  }),
  /** What customers have yet to return, as the pending returns list has it. */
  pendingReturns: z.object({
    quantity: z.int().nonnegative(),
    /** How many customers have any pending. */
    customers: z.int().nonnegative(),
    /** How many of the cylinders pending are overdue. */
    overdue: z.int().nonnegative(),
  }),
  /**
   * How many counts are below zero as of today, which means that bills are
   * missing or wrong.
   */
  belowZero: z.object({
    /** At the shop, one for each gas and fill state. */
    shop: z.int().nonnegative(),
    /** With customers and refillers, one for each party and gas. */
    parties: z.int().nonnegative(),
  }),
});

export type Dashboard = z.infer<typeof dashboardSchema>;
