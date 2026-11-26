import { z } from "zod";
import { dateSchema } from "./date";
import { gasSchema } from "./gas";
import { PARTY_TYPES } from "./party";
import { queryPage } from "./query";
import { optionalText, requiredText } from "./text";
import { vehicleSchema } from "./vehicle";

export const FILL_STATES = ["filled", "empty", "defective"] as const;

export const fillStateSchema = z.enum(FILL_STATES, "Choose filled, empty or defective.");

export type FillState = z.infer<typeof fillStateSchema>;

export const billTypeSchema = z.enum(["opening_stock", "dispatch"]);

export type BillType = z.infer<typeof billTypeSchema>;

/** Which of the agency's paper a bill was written on. */
export const PAPER_KINDS = ["bill", "cash_memo"] as const;

export const paperKindSchema = z.enum(PAPER_KINDS, "Choose bill or cash memo.");

export type PaperKind = z.infer<typeof paperKindSchema>;

/** The paper kinds as people read them, on the screens and in refusals. */
export const PAPER_KIND_NAMES: Record<PaperKind, string> = {
  bill: "Bill",
  cash_memo: "Cash memo",
};

/** A party as a bill names it, which may be the shop. */
export const billPartySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  type: z.enum(["shop", ...PARTY_TYPES]),
});

export type BillParty = z.infer<typeof billPartySchema>;

export const billStaffSchema = z.object({
  id: z.uuid(),
  displayName: z.string().min(1),
});

export const billLineSchema = z.object({
  id: z.uuid(),
  gas: gasSchema.pick({ id: true, name: true }),
  fillState: fillStateSchema,
  quantity: z.int().positive(),
});

export type BillLine = z.infer<typeof billLineSchema>;

/** A bill with everything on it. */
export const billSchema = z.object({
  id: z.uuid(),
  type: billTypeSchema,
  /** Set on bills numbered from the agency's own paper, and only on those. */
  paperKind: paperKindSchema.nullable(),
  number: z.string().min(1),
  date: dateSchema,
  /** Only posted bills count. */
  status: z.enum(["posted", "cancelled"]),
  /** Whom the cylinders leave, or null when they join the business. */
  from: billPartySchema.nullable(),
  /** Who receives them, or null when they leave the business. */
  to: billPartySchema.nullable(),
  /** Which vehicle carried the cylinders, if the bill says. */
  vehicle: vehicleSchema.pick({ id: true, plate: true, label: true }).nullable(),
  notes: z.string().nullable(),
  lines: z.array(billLineSchema),
  enteredBy: billStaffSchema,
  enteredAt: z.iso.datetime(),
});

export type Bill = z.infer<typeof billSchema>;

export const billListQuerySchema = z.object({
  page: queryPage,
});

export type BillListQuery = z.infer<typeof billListQuerySchema>;

/** One page of bills, the newest first. */
export const billListSchema = z.object({
  bills: z.array(
    billSchema.pick({
      id: true,
      type: true,
      paperKind: true,
      number: true,
      date: true,
      status: true,
      from: true,
      to: true,
      lines: true,
    }),
  ),
  /** How many bills there are, on every page together. */
  total: z.int().nonnegative(),
  page: z.int().positive(),
  pageSize: z.int().positive(),
});

export type BillList = z.infer<typeof billListSchema>;

const MOST_LINES = 100;
const MOST_ON_A_LINE = 100_000;

const WHOLE_NUMBER = "Enter each quantity as a whole number.";

/** One line of a bill as it is entered. */
export const newBillLineSchema = z.object(
  {
    gasId: z.uuid("Choose a gas on each line."),
    fillState: fillStateSchema,
    quantity: z
      .number(WHOLE_NUMBER)
      .int(WHOLE_NUMBER)
      .min(1, "Enter a quantity of 1 or more on each line.")
      .max(MOST_ON_A_LINE, "Enter at most 100000 on a line."),
  },
  "Fill in each line.",
);

export type NewBillLine = z.infer<typeof newBillLineSchema>;

export const newBillLinesSchema = z
  .array(newBillLineSchema, "Add at least one line.")
  .min(1, "Add at least one line.")
  .max(MOST_LINES, `Use at most ${MOST_LINES} lines.`);

/** A bill's number, as copied from the agency's paper. */
export const billNumberSchema = requiredText({
  missing: "Enter the bill number.",
  max: 30,
  tooLong: "Use a bill number of at most 30 characters.",
});

/**
 * A dispatch bill as it is entered. The cylinders always leave the shop, so only
 * the customer is named.
 */
export const newDispatchSchema = z.object({
  type: z.literal("dispatch", "Choose the type of bill."),
  paperKind: paperKindSchema,
  number: billNumberSchema,
  date: z.iso.date("Choose the bill date."),
  customerId: z.uuid("Choose a customer."),
  vehicleId: z.uuid("Choose a vehicle from the list.").nullable().default(null),
  notes: optionalText({ max: 1000, tooLong: "Use notes of at most 1000 characters." }).default(
    null,
  ),
  lines: newBillLinesSchema,
});

export type NewDispatch = z.infer<typeof newDispatchSchema>;

/** Asks whether a number is taken, while it is being typed. */
export const billNumberUseQuerySchema = z.object({
  paperKind: paperKindSchema,
  number: billNumberSchema,
});

export type BillNumberUseQuery = z.infer<typeof billNumberUseQuerySchema>;

export const billNumberUseSchema = z.object({
  /** The posted bill that has the number on this paper kind, or null if it is free. */
  usedBy: billSchema.pick({ id: true, date: true }).nullable(),
});

export type BillNumberUse = z.infer<typeof billNumberUseSchema>;
