import { z } from "zod";
import { dateSchema, indianDate } from "./date";
import { gasSchema } from "./gas";
import { PARTY_TYPES } from "./party";
import { optionalChoice, queryPage } from "./query";
import type { Staff } from "./staff";
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
  return paperKind ? billName({ paperKind, number }) : "Opening stock";
}

/** What staff call one bill, such as "Cash memo 88", or its number if it was not on paper. */
export function billName({
  paperKind,
  number,
}: {
  paperKind: PaperKind | null;
  number: string;
}): string {
  return paperKind ? `${PAPER_KIND_NAMES[paperKind]} ${number}` : number;
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

/** Only posted bills count. A cancelled bill stays to be read, and is never posted again. */
export const billStatusSchema = z.enum(["posted", "cancelled"], "Choose posted or cancelled.");

export type BillStatus = z.infer<typeof billStatusSchema>;

export const CANCEL_REASONS = [
  "data_entry_error",
  "duplicate_entry",
  "customer_rejected",
  "wrong_cylinder_loaded",
  "bill_voided",
  "other",
] as const;

export const cancelReasonSchema = z.enum(CANCEL_REASONS, "Choose why the bill is cancelled.");

export type CancelReason = z.infer<typeof cancelReasonSchema>;

/** A cancellation as it is asked for. Which bill it is said beside this. */
export const newCancellationSchema = z.object({
  reason: cancelReasonSchema,
  notes: optionalText({ max: 1000, tooLong: "Use notes of at most 1000 characters." }).default(
    null,
  ),
});

export type NewCancellation = z.infer<typeof newCancellationSchema>;

/** Who cancelled a bill, when and why. */
export const cancellationSchema = z.object({
  reason: cancelReasonSchema,
  notes: z.string().nullable(),
  cancelledBy: billStaffSchema,
  cancelledAt: z.iso.datetime(),
});

export type Cancellation = z.infer<typeof cancellationSchema>;

/** What a bill says that a correction can change. */
export const billContentSchema = z.object({
  /** Set on bills numbered from the agency's own paper, and only on those. */
  paperKind: paperKindSchema.nullable(),
  number: z.string().min(1),
  date: dateSchema,
  /** Whom the cylinders leave, or null when they join the business. */
  from: billPartySchema.nullable(),
  /** Who receives them, or null when they leave the business. */
  to: billPartySchema.nullable(),
  /** Which vehicle carried the cylinders, if the bill says. */
  vehicle: vehicleSchema.pick({ id: true, plate: true, label: true }).nullable(),
  notes: z.string().nullable(),
  lines: z.array(billLineSchema),
});

export type BillContent = z.infer<typeof billContentSchema>;

/**
 * A version of a bill that a correction has since replaced, as it read then, with
 * who entered or corrected the bill to read so, and when.
 */
export const billVersionSchema = billContentSchema.extend({
  savedBy: billStaffSchema,
  savedAt: z.iso.datetime(),
});

export type BillVersion = z.infer<typeof billVersionSchema>;

/** A bill with everything on it. */
export const billSchema = billContentSchema.extend({
  id: z.uuid(),
  type: billTypeSchema,
  /** The paper return slip's number, if one was noted on a return. */
  slipNumber: z.string().nullable(),
  status: billStatusSchema,
  /** Set on cancelled bills, and only on those. */
  cancellation: cancellationSchema.nullable(),
  /** Who made the bill read as it does now, if it has been corrected, and when. */
  lastCorrection: z
    .object({ correctedBy: billStaffSchema, correctedAt: z.iso.datetime() })
    .nullable(),
  /** What it said before each correction, the oldest first. Empty if never corrected. */
  earlierVersions: z.array(billVersionSchema),
  enteredBy: billStaffSchema,
  enteredAt: z.iso.datetime(),
  /** Set on posted dispatch bills and customers' opening stock, and only on those. */
  returns: billReturnsSchema.nullable(),
});

export type Bill = z.infer<typeof billSchema>;

export const billListQuerySchema = z.object({
  /** Narrows the list to the bills that count, or to those cancelled. */
  status: optionalChoice(billStatusSchema),
  page: queryPage,
});

export type BillListQuery = z.infer<typeof billListQuerySchema>;

/** One page of the bills asked for, the newest first. */
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
  /** How many such bills there are, on every page together. */
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

/**
 * Why this person is not allowed to cancel the bill, or null if they are. Admins
 * may cancel any bill. Staff may cancel only those they entered today, by the
 * date in India, and no opening stock. The API holds everyone to this; the
 * screens ask it too, to offer cancelling only to those allowed. Whether the bill
 * itself can be cancelled is for the API to say.
 */
export function whyNotCancel(bill: Entered, staff: Asker, today: string): string | null {
  return whyNotChange("cancel", bill, staff, today);
}

/**
 * Why this person is not allowed to correct the bill, or null if they are. The
 * rule is the one for cancelling, and is used the same way. Whether anyone can
 * correct the bill is for whyUncorrectable to say.
 */
export function whyNotCorrect(bill: Entered, staff: Asker, today: string): string | null {
  return whyNotChange("correct", bill, staff, today);
}

/**
 * Why nobody can correct the bill, whoever they are, or null if it can be
 * corrected. The API and the screens both say so in these words.
 */
export function whyUncorrectable({
  type,
  status,
}: {
  type: BillType;
  status: BillStatus;
}): string | null {
  if (type === "return_from_customer") {
    return "A return cannot be corrected. Cancel it and record it again.";
  }
  if (status === "cancelled") {
    return "This bill has been cancelled, so it cannot be corrected.";
  }
  return null;
}

/** Who entered a bill and when, which with its type decides who may change it. */
interface Entered {
  type: BillType;
  enteredBy: { id: string };
  enteredAt: string | Date;
}

type Asker = Pick<Staff, "id" | "isAdmin">;

function whyNotChange(
  change: "cancel" | "correct",
  { type, enteredBy, enteredAt }: Entered,
  staff: Asker,
  today: string,
): string | null {
  if (staff.isAdmin) {
    return null;
  }
  if (type === "opening_stock") {
    return `Only an admin can ${change} opening stock.`;
  }
  if (enteredBy.id !== staff.id || indianDate(new Date(enteredAt)) !== today) {
    return `You can ${change} only bills you entered today. Ask an admin to ${change} this one.`;
  }
  return null;
}

/** One line of a bill as it is entered. */
export const newBillLineSchema = z.object(
  {
    // In small letters, as the database gives ids back, so that they can be matched.
    gasId: z.uuid("Choose a gas on each line.").toLowerCase(),
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

const refillerIdSchema = z.uuid("Choose a refiller.").toLowerCase();

/** What every bill entered from paper says, besides its number and its party. */
const paperFields = {
  date: z.iso.date("Choose the bill date."),
  vehicleId: z.uuid("Choose a vehicle from the list.").toLowerCase().nullable().default(null),
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
  customerId: z.uuid("Choose a customer.").toLowerCase(),
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

/** Opening stock as it is corrected. Its party, date and number stay as they are. */
export const openingStockCorrectionSchema = z.object({
  type: z.literal("opening_stock", CHOOSE_TYPE),
  lines: newBillLinesSchema,
});

/**
 * A posted bill as it is to read once corrected, which is all of it again. Its
 * type cannot change, and a return from a customer is never corrected.
 */
export const billCorrectionSchema = z.discriminatedUnion(
  "type",
  [
    newDispatchSchema,
    newSendToRefillerSchema,
    newReturnFromRefillerSchema,
    openingStockCorrectionSchema,
  ],
  CHOOSE_TYPE,
);

export type BillCorrection = z.infer<typeof billCorrectionSchema>;

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
