import { z } from "zod";
import { dateSchema, indianDate } from "./date";
import { gasSchema } from "./gas";
import { PARTY_TYPES } from "./party";
import { optionalChoice, queryDate, queryFlag, queryPage, querySearch } from "./query";
import type { Staff } from "./staff";
import { optionalText, requiredText } from "./text";
import { vehicleSchema } from "./vehicle";

export const FILL_STATES = ["filled", "empty", "defective"] as const;

export const fillStateSchema = z.enum(FILL_STATES, "Choose filled, empty or defective.");

export type FillState = z.infer<typeof fillStateSchema>;

export const billTypeSchema = z.enum(
  [
    "opening_stock",
    "dispatch",
    "send_to_refiller",
    "return_from_refiller",
    "return_from_customer",
    "add_cylinders",
    "write_off",
  ],
  "Choose the type of bill.",
);

export type BillType = z.infer<typeof billTypeSchema>;

/** The types of bill as people read them, on the screens and in files. */
export const BILL_TYPE_NAMES: Record<BillType, string> = {
  opening_stock: "Opening stock",
  dispatch: "Dispatch",
  send_to_refiller: "Send to refiller",
  return_from_refiller: "Return from refiller",
  return_from_customer: "Return",
  add_cylinders: "Add cylinders",
  write_off: "Write-off",
};

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

export const WRITE_OFF_REASONS = ["scrapped", "lost"] as const;

export const writeOffReasonSchema = z.enum(WRITE_OFF_REASONS, "Choose scrapped or lost.");

export type WriteOffReason = z.infer<typeof writeOffReasonSchema>;

export const WRITE_OFF_REASON_NAMES: Record<WriteOffReason, string> = {
  scrapped: "Scrapped",
  lost: "Lost",
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

/**
 * How much of a bill has been cleared, by cylinders coming back or being written
 * off: none, some or all of it.
 */
export const returnStatusSchema = z.enum(["open", "partly_returned", "closed"]);

export type ReturnStatus = z.infer<typeof returnStatusSchema>;

const billGasSchema = gasSchema.pick({ id: true, name: true });

/** The types of bill that clear pending cylinders. */
const clearingTypeSchema = billTypeSchema.extract(["return_from_customer", "write_off"]);

export type ClearingType = z.infer<typeof clearingTypeSchema>;

/**
 * Counts of the cylinders a bill sent, those since returned, those since written
 * off and those still pending.
 */
const returnCounts = {
  sent: z.int().positive(),
  returned: z.int().nonnegative(),
  writtenOff: z.int().nonnegative(),
  pending: z.int().nonnegative(),
};

/** Those counts for a whole bill, of every gas together. */
const billReturnCountsSchema = z.object(returnCounts);

export type ReturnCounts = z.infer<typeof billReturnCountsSchema>;

/**
 * What has come back or been written off against a bill that cylinders can be
 * pending on.
 */
export const billReturnsSchema = z.object({
  ...returnCounts,
  status: returnStatusSchema,
  /** One for each gas on the bill, however many lines it is on. */
  gases: z.array(z.object({ gas: billGasSchema, ...returnCounts })),
  /**
   * Each posted return and write-off with cylinders matched to this bill, the
   * oldest first.
   */
  entries: z.array(
    z.object({
      id: z.uuid(),
      type: clearingTypeSchema,
      number: z.string().min(1),
      date: dateSchema,
      /** The cylinders matched to this bill, which may be only part of a return's. */
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
  /** Set on write-offs, and only on those. Versions kept before there were any lack it. */
  writeOffReason: writeOffReasonSchema.nullable().default(null),
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
  /** Narrows the list to the bills whose number contains this. */
  number: querySearch,
  /** Narrows the list to the returns whose paper slip number contains this. */
  slipNumber: querySearch,
  paperKind: optionalChoice(paperKindSchema),
  type: optionalChoice(billTypeSchema),
  /** Narrows the list to the bills naming a customer, refiller or supplier like this. */
  party: querySearch,
  /** Narrows the list to the bills naming this one party. */
  partyId: optionalChoice(z.uuid("Choose a party.").toLowerCase()),
  /** The first and last dates of the bills wanted. */
  from: queryDate,
  to: queryDate,
  /** Narrows the list to the bills that count, or to those cancelled. */
  status: optionalChoice(billStatusSchema),
  /** Whether to list only the dispatch bills with cylinders pending. */
  pending: queryFlag,
  page: queryPage,
});

export type BillListQuery = z.infer<typeof billListQuerySchema>;

/** A bill as a list shows it. */
export const listedBillSchema = billSchema
  .pick({
    id: true,
    type: true,
    paperKind: true,
    number: true,
    date: true,
    status: true,
    from: true,
    to: true,
    writeOffReason: true,
    lines: true,
  })
  .extend({
    /** Set on posted dispatch bills, and only on those. */
    returns: billReturnCountsSchema.nullable(),
  });

export type ListedBill = z.infer<typeof listedBillSchema>;

/** One page of the bills asked for, the newest first. */
export const billListSchema = z.object({
  bills: z.array(listedBillSchema),
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
 * Why this person is not allowed to enter a bill of this type on the new bill
 * form, or null if they are. The API and the form both ask.
 */
export function whyNotEnter(type: NewBill["type"], staff: Pick<Staff, "isAdmin">): string | null {
  const adminsOnly = ADMIN_BILLS[type];
  return adminsOnly && !staff.isAdmin ? `Only an admin can ${adminsOnly.enter}.` : null;
}

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
  from,
}: {
  type: BillType;
  status: BillStatus;
  /** Whom the cylinders leave, which tells apart the write-offs. */
  from: Pick<BillParty, "type"> | null;
}): string | null {
  if (type === "return_from_customer") {
    return "A return cannot be corrected. Cancel it and record it again.";
  }
  if (status === "cancelled") {
    return "This bill has been cancelled, so it cannot be corrected.";
  }
  if (type === "write_off" && from?.type === "customer") {
    return "A write-off from a customer cannot be corrected. Cancel it and enter it again.";
  }
  return null;
}

/**
 * The types of bill that only an admin may enter, correct or cancel, with how the
 * refusals name one and what they call entering it.
 */
const ADMIN_BILLS: Partial<Record<BillType, { one: string; enter: string }>> = {
  opening_stock: { one: "opening stock", enter: "enter opening stock" },
  add_cylinders: { one: "an add cylinders bill", enter: "add cylinders" },
  write_off: { one: "a write-off", enter: "write off cylinders" },
};

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
  const adminsOnly = ADMIN_BILLS[type];
  if (adminsOnly) {
    return `Only an admin can ${change} ${adminsOnly.one}.`;
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

/** What every bill entered on the new bill form says, whatever its type. */
const formFields = {
  date: z.iso.date("Choose the bill date."),
  notes: optionalText({ max: 1000, tooLong: "Use notes of at most 1000 characters." }).default(
    null,
  ),
  lines: newBillLinesSchema,
};

/** What every bill entered from paper says, besides its number and its party. */
const paperFields = {
  ...formFields,
  vehicleId: z.uuid("Choose a vehicle from the list.").toLowerCase().nullable().default(null),
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

/**
 * Cylinders joining the business at the shop, as they are entered. The app gives
 * the bill its number.
 */
export const newAddCylindersSchema = z.object({
  type: z.literal("add_cylinders", CHOOSE_TYPE),
  /** Left out when the bill names no supplier. */
  supplierId: z.uuid("Choose a supplier from the list.").toLowerCase().nullable().default(null),
  ...formFields,
});

export type NewAddCylinders = z.infer<typeof newAddCylindersSchema>;

/**
 * Cylinders scrapped or lost at the shop or a refiller, as they are entered. A
 * customer's are written off against a bill, and are entered as
 * newCustomerWriteOffSchema says. The app gives the bill its number.
 */
export const newWriteOffSchema = z.object({
  type: z.literal("write_off", CHOOSE_TYPE),
  /** The refiller who had them, or null for the shop. */
  refillerId: refillerIdSchema.nullable(),
  writeOffReason: writeOffReasonSchema,
  ...formFields,
});

export type NewWriteOff = z.infer<typeof newWriteOffSchema>;

/**
 * Cylinders a customer has scrapped or lost, as they are entered: some of one gas
 * pending on a dispatch bill or the customer's opening stock, which they then no
 * longer are. The app gives the bill its number.
 */
export const newCustomerWriteOffSchema = z.object({
  // In small letters, as the database gives ids back, so that they can be matched.
  customerId: z.uuid("Choose a customer.").toLowerCase(),
  billId: z.uuid("Choose the pending cylinders to write off.").toLowerCase(),
  gasId: z.uuid("Choose the pending cylinders to write off.").toLowerCase(),
  quantity: quantitySchema,
  writeOffReason: writeOffReasonSchema,
  date: formFields.date,
  notes: formFields.notes,
});

export type NewCustomerWriteOff = z.infer<typeof newCustomerWriteOffSchema>;

/** A bill of any type the new bill form saves as a bill's lines. */
export const newBillSchema = z.discriminatedUnion(
  "type",
  [
    newDispatchSchema,
    newSendToRefillerSchema,
    newReturnFromRefillerSchema,
    newAddCylindersSchema,
    newWriteOffSchema,
  ],
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
 * type cannot change, and neither a return from a customer nor a write-off from
 * one is ever corrected.
 */
export const billCorrectionSchema = z.discriminatedUnion(
  "type",
  [...newBillSchema.options, openingStockCorrectionSchema],
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
