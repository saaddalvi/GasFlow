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

export const billTypeSchema = z.enum([
  "opening_stock",
  "dispatch",
  "send_to_refiller",
  "return_from_refiller",
  "return_from_customer",
]);

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

/**
 * What staff call a bill that cylinders are pending on, such as "Bill 1234" or
 * "Opening stock". Only dispatch bills, which have a paper kind, and opening
 * stock, which has none, can have cylinders pending.
 */
export function pendingBillName({
  paperKind,
  number,
}: {
  paperKind: PaperKind | null;
  number: string;
}): string {
  return paperKind ? `${PAPER_KIND_NAMES[paperKind]} ${number}` : "Opening stock";
}

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

/** How much of a bill has come back: none, some or all of it. */
export const returnStatusSchema = z.enum(["open", "partly_returned", "closed"]);

export type ReturnStatus = z.infer<typeof returnStatusSchema>;

const billGasSchema = gasSchema.pick({ id: true, name: true });

/** Counts of the cylinders a bill sent, those since returned and those still pending. */
const returnCounts = {
  sent: z.int().positive(),
  returned: z.int().nonnegative(),
  pending: z.int().nonnegative(),
};

/** What has come back against a bill that cylinders can be pending on. */
export const billReturnsSchema = z.object({
  ...returnCounts,
  status: returnStatusSchema,
  /** One for each gas on the bill, however many lines it is on. */
  gases: z.array(z.object({ gas: billGasSchema, ...returnCounts })),
  /** Each posted return with cylinders matched to this bill, the oldest first. */
  entries: z.array(
    z.object({
      id: z.uuid(),
      number: z.string().min(1),
      date: dateSchema,
      /** The cylinders matched to this bill, which may be only part of the return. */
      quantity: z.int().positive(),
      gases: z.array(z.object({ gas: billGasSchema, quantity: z.int().positive() })),
      enteredBy: billStaffSchema,
    }),
  ),
});

export type BillReturns = z.infer<typeof billReturnsSchema>;

/** A bill with everything on it. */
export const billSchema = z.object({
  id: z.uuid(),
  type: billTypeSchema,
  /** Set on bills numbered from the agency's own paper, and only on those. */
  paperKind: paperKindSchema.nullable(),
  number: z.string().min(1),
  date: dateSchema,
  /** The paper return slip's number, if one was noted on a return. */
  slipNumber: z.string().nullable(),
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
  /** Set on dispatch bills and customers' opening stock, and only on those. */
  returns: billReturnsSchema.nullable(),
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

/** How many cylinders one entry may move. */
export const quantitySchema = z
  .number(WHOLE_NUMBER)
  .int(WHOLE_NUMBER)
  .min(1, "Enter a quantity of 1 or more on each line.")
  .max(MOST_ON_A_LINE, "Enter at most 100000 on a line.");

/** One line of a bill as it is entered. */
export const newBillLineSchema = z.object(
  {
    gasId: z.uuid("Choose a gas on each line."),
    fillState: fillStateSchema,
    quantity: quantitySchema,
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

const CHOOSE_TYPE = "Choose the type of bill.";

const refillerIdSchema = z.uuid("Choose a refiller.");

/** What every bill entered from paper says, besides its number and its party. */
const paperFields = {
  date: z.iso.date("Choose the bill date."),
  vehicleId: z.uuid("Choose a vehicle from the list.").nullable().default(null),
  notes: optionalText({ max: 1000, tooLong: "Use notes of at most 1000 characters." }).default(
    null,
  ),
  lines: newBillLinesSchema,
};

/**
 * A dispatch bill as it is entered. The cylinders always leave the shop, so only
 * the customer is named.
 */
export const newDispatchSchema = z.object({
  type: z.literal("dispatch", CHOOSE_TYPE),
  paperKind: paperKindSchema,
  number: billNumberSchema,
  customerId: z.uuid("Choose a customer."),
  ...paperFields,
});

export type NewDispatch = z.infer<typeof newDispatchSchema>;

/** A send to a refiller as it is entered, also numbered from the agency's paper. */
export const newSendToRefillerSchema = z.object({
  type: z.literal("send_to_refiller", CHOOSE_TYPE),
  paperKind: paperKindSchema,
  number: billNumberSchema,
  refillerId: refillerIdSchema,
  ...paperFields,
});

export type NewSendToRefiller = z.infer<typeof newSendToRefillerSchema>;

/**
 * A refiller's slip number, which is the bill number of a return from that
 * refiller. Not the optional slip number noted on a customer's return.
 */
export const refillerSlipNumberSchema = requiredText({
  missing: "Enter the refiller's slip number.",
  max: 30,
  tooLong: "Use a slip number of at most 30 characters.",
});

/** A return from a refiller as it is entered, under the refiller's slip number. */
export const newReturnFromRefillerSchema = z.object({
  type: z.literal("return_from_refiller", CHOOSE_TYPE),
  number: refillerSlipNumberSchema,
  refillerId: refillerIdSchema,
  ...paperFields,
});

export type NewReturnFromRefiller = z.infer<typeof newReturnFromRefillerSchema>;

/** A bill of any type the new bill form offers. */
export const newBillSchema = z.discriminatedUnion(
  "type",
  [newDispatchSchema, newSendToRefillerSchema, newReturnFromRefillerSchema],
  CHOOSE_TYPE,
);

export type NewBill = z.infer<typeof newBillSchema>;

/** Asks whether a number is taken, while it is being typed. */
export const billNumberUseQuerySchema = z.object({
  paperKind: paperKindSchema,
  number: billNumberSchema,
});

export type BillNumberUseQuery = z.infer<typeof billNumberUseQuerySchema>;

/** Asks whether a refiller's slip number is taken, while it is being typed. */
export const refillerRefillerSlipNumberUseQuerySchema = z.object({
  refillerId: refillerIdSchema,
  number: refillerSlipNumberSchema,
});

export type RefillerSlipNumberUseQuery = z.infer<typeof refillerRefillerSlipNumberUseQuerySchema>;

export const billNumberUseSchema = z.object({
  /** The posted bill that has the number, or null if it is free. */
  usedBy: billSchema.pick({ id: true, date: true }).nullable(),
});

export type BillNumberUse = z.infer<typeof billNumberUseSchema>;
