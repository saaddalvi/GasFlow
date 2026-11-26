import { z } from "zod";
import { billPartySchema, billSchema, fillStateSchema, quantitySchema } from "./bill";
import { gasSchema } from "./gas";
import { partyListQuerySchema, partySchema } from "./party";
import { queryPage } from "./query";
import { optionalText } from "./text";

/**
 * Cylinders coming back against one gas on a dispatch bill or opening stock, as
 * Receive empties sends them.
 */
export const newAllocationSchema = z.object(
  {
    // In small letters, as the database gives ids back, so that they can be matched.
    billId: z.uuid("Choose a bill on each row.").toLowerCase(),
    gasId: z.uuid("Choose a gas on each row.").toLowerCase(),
    quantity: quantitySchema,
    fillState: fillStateSchema.default("empty"),
  },
  "Fill in each row.",
);

export type NewAllocation = z.infer<typeof newAllocationSchema>;

/**
 * Cylinders coming back that are in excess of everything pending, and so are
 * matched to no bill yet.
 */
export const newUnmatchedSchema = z.object(
  {
    gasId: z.uuid("Choose a gas on each unmatched row.").toLowerCase(),
    quantity: quantitySchema,
    fillState: fillStateSchema.default("empty"),
  },
  "Fill in each unmatched row.",
);

export type NewUnmatched = z.infer<typeof newUnmatchedSchema>;

const NOTHING_RETURNED = "Enter how many cylinders came back on at least one row.";
const MOST_ROWS = 1000;

/** The rows of one sort that a return may have, which may be none. */
const returnRows = <Row extends z.ZodType>(row: Row) =>
  z.array(row, NOTHING_RETURNED).max(MOST_ROWS, `Use at most ${MOST_ROWS} rows.`).default([]);

/** A return as it is entered. The cylinders always come back to the shop. */
export const newReturnSchema = z
  .object({
    customerId: z.uuid("Choose a customer.").toLowerCase(),
    date: z.iso.date("Choose the return date."),
    /** The paper return slip's number, which need not be unique. */
    slipNumber: optionalText({
      max: 30,
      tooLong: "Use a slip number of at most 30 characters.",
    }).default(null),
    allocations: returnRows(newAllocationSchema),
    unmatched: returnRows(newUnmatchedSchema),
  })
  .refine(
    ({ allocations, unmatched }) => allocations.length + unmatched.length > 0,
    NOTHING_RETURNED,
  );

export type NewReturn = z.infer<typeof newReturnSchema>;

/** What was saved, as its confirmation names it. */
export const receivedReturnSchema = z.object({
  id: z.uuid(),
  number: z.string().min(1),
  customer: billPartySchema.pick({ id: true, name: true }),
  /** Cylinders on all the rows together. */
  quantity: z.int().positive(),
  /** How many of them were saved as unmatched. */
  unmatched: z.int().nonnegative(),
  /** The bills the cylinders were returned against, the oldest first. */
  bills: z.array(billSchema.pick({ id: true, paperKind: true, number: true })),
});

export type ReceivedReturn = z.infer<typeof receivedReturnSchema>;

/** Asks what a customer can return cylinders against on a date. */
export const pendingQuerySchema = z.object({
  customerId: z.uuid("Choose a customer."),
  date: z.iso.date("Choose the return date."),
});

export type PendingQuery = z.infer<typeof pendingQuerySchema>;

/** One gas on one dispatch bill or opening stock. */
export const pendingRowSchema = z.object({
  bill: billSchema.pick({ id: true, type: true, paperKind: true, number: true, date: true }),
  gas: gasSchema.pick({ id: true, name: true }),
  sent: z.int().positive(),
  returned: z.int().nonnegative(),
  pending: z.int().nonnegative(),
});

export type PendingRow = z.infer<typeof pendingRowSchema>;

/** The rows with cylinders pending, the oldest first. */
export const pendingListSchema = z.object({
  rows: z.array(
    pendingRowSchema.extend({
      /** The days since the bill's date, which for opening stock is the start date. */
      daysOut: z.int().nonnegative(),
    }),
  ),
});

export type PendingList = z.infer<typeof pendingListSchema>;

/** Asks for the rows with nothing pending, a page at a time. */
export const closedRowListQuerySchema = pendingQuerySchema.extend({ page: queryPage });

export type ClosedRowListQuery = z.infer<typeof closedRowListQuerySchema>;

/** One page of the rows with nothing pending, the newest first. */
export const closedRowListSchema = z.object({
  rows: z.array(pendingRowSchema),
  /** How many such rows there are, on every page together. */
  total: z.int().nonnegative(),
  page: z.int().positive(),
  pageSize: z.int().positive(),
});

export type ClosedRowList = z.infer<typeof closedRowListSchema>;

/** Which customers Receive empties offers. */
export const returnCustomerListQuerySchema = partyListQuerySchema.pick({
  search: true,
  page: true,
});

export type ReturnCustomerListQuery = z.infer<typeof returnCustomerListQuerySchema>;

/** One page of the active customers by name, each with what they have pending. */
export const returnCustomerListSchema = z.object({
  customers: z.array(
    partySchema.pick({ id: true, name: true, mobile: true }).extend({
      /** Cylinders pending on all their bills together, of every gas. */
      pending: z.int().nonnegative(),
    }),
  ),
  /** How many customers match, on every page together. */
  total: z.int().nonnegative(),
  page: z.int().positive(),
  pageSize: z.int().positive(),
});

export type ReturnCustomerList = z.infer<typeof returnCustomerListSchema>;

const WHOLE_TOTAL = "Enter the total as a whole number of cylinders.";

/** Asks how "Fill oldest first" would split a total of one gas. */
export const splitQuerySchema = pendingQuerySchema.extend({
  gasId: z.uuid("Choose a gas to fill.").toLowerCase(),
  total: z.coerce
    .number(WHOLE_TOTAL)
    .int(WHOLE_TOTAL)
    .min(1, "Enter a total of 1 or more.")
    .max(1_000_000, "Enter a total of at most 1000000."),
});

export type SplitQuery = z.infer<typeof splitQuerySchema>;

/** The split "Fill oldest first" proposes. Nothing is saved until staff save the return. */
export const splitSchema = z.object({
  /** How many to return against each bill of the gas, the oldest first. */
  rows: z.array(z.object({ billId: z.uuid(), quantity: z.int().positive() })),
  /** What is left over once everything eligible is filled. */
  excess: z.int().nonnegative(),
});

export type Split = z.infer<typeof splitSchema>;

/** Asks for the unmatched returns, a page at a time. */
export const unmatchedListQuerySchema = z.object({ page: queryPage });

export type UnmatchedListQuery = z.infer<typeof unmatchedListQuerySchema>;

/** The unmatched cylinders of one gas on one return. */
export const unmatchedRowSchema = z.object({
  return: billSchema.pick({ id: true, number: true, date: true }),
  customer: billPartySchema.pick({ id: true, name: true }),
  gas: gasSchema.pick({ id: true, name: true }),
  quantity: z.int().positive(),
});

export type UnmatchedRow = z.infer<typeof unmatchedRowSchema>;

/** One page of the unmatched cylinders, the oldest return first. */
export const unmatchedListSchema = z.object({
  rows: z.array(unmatchedRowSchema),
  /** How many such rows there are, on every page together. */
  total: z.int().nonnegative(),
  page: z.int().positive(),
  pageSize: z.int().positive(),
});

export type UnmatchedList = z.infer<typeof unmatchedListSchema>;

/**
 * Unmatched cylinders of one gas to be matched to a dispatch bill or opening
 * stock. Which return they are on is said beside this.
 */
export const newMatchSchema = z.object({
  billId: z.uuid("Choose a bill to match to.").toLowerCase(),
  gasId: z.uuid("Choose a gas to match.").toLowerCase(),
  quantity: quantitySchema,
});

export type NewMatch = z.infer<typeof newMatchSchema>;

/** What a match leaves. */
export const matchedSchema = z.object({
  /** How many cylinders of the gas the return still has unmatched. */
  unmatched: z.int().nonnegative(),
});

export type Matched = z.infer<typeof matchedSchema>;
