import { z } from "zod";
import { billSchema, billTypeSchema, paperKindSchema, type BillType } from "./bill";
import { dateSchema } from "./date";
import { gasSchema } from "./gas";
import { gasHeldSchema } from "./holding";
import { REGISTER_PARTY_TYPES } from "./balance-register";
import { partySchema } from "./party";
import { queryDate, queryFlag } from "./query";

export const stockCardQuerySchema = z.object({
  partyId: z.uuid("Choose a customer or refiller.").toLowerCase(),
  /**
   * The first and last dates wanted. Left out, the last is today and the first is
   * 1 April of the last one's financial year.
   */
  from: queryDate,
  to: queryDate,
  /** Whether to begin where the records do, whatever first date is given. */
  full: queryFlag,
});

export type StockCardQuery = z.infer<typeof stockCardQuerySchema>;

const cardGasSchema = gasSchema.pick({ id: true, name: true });

/** What happened to one gas over a stretch of a card, and what was held at its end. */
export const stockCardFiguresSchema = z.object({
  gas: cardGasSchema,
  /** By dispatch to a customer, or send to a refiller. */
  sent: z.int().nonnegative(),
  /** By return from a customer, matched or not, or from a refiller. */
  returned: z.int().nonnegative(),
  writtenOff: z.int().nonnegative(),
  /** Below zero when bills take away more than were there. */
  holding: z.int(),
});

export type StockCardFigures = z.infer<typeof stockCardFiguresSchema>;

/** A dispatch bill or opening stock that cylinders were returned or written off against. */
const matchedBillSchema = z.object({
  id: z.uuid(),
  type: billTypeSchema.extract(["dispatch", "opening_stock"]),
  paperKind: paperKindSchema.nullable(),
  number: z.string().min(1),
});

export type StockCardMatchedBill = z.infer<typeof matchedBillSchema>;

/** The cylinders of one gas on a bill, however many of its lines they are on. */
const stockCardLineSchema = z.object({
  gas: cardGasSchema,
  quantity: z.int().positive(),
  /**
   * What a return from a customer, or a write-off from one, was against, the
   * oldest of those bills first. Nothing else is matched to a bill.
   */
  against: z.array(z.object({ bill: matchedBillSchema, quantity: z.int().positive() })),
  /** What a return from a customer has yet to be matched to any bill. */
  unmatched: z.int().nonnegative(),
});

export type StockCardLine = z.infer<typeof stockCardLineSchema>;

const FIGURE_NAMES = {
  returned: "Received back",
  writtenOff: "Written off",
  holding: "Holding",
};

/**
 * What a card of a party of each type heads its figures, on the screen and in the
 * file. Only a customer is sent cylinders by dispatch.
 */
export const CARD_FIGURE_NAMES = {
  customer: { sent: "Dispatched", ...FIGURE_NAMES },
  refiller: { sent: "Sent", ...FIGURE_NAMES },
} satisfies Record<
  (typeof REGISTER_PARTY_TYPES)[number],
  Record<"sent" | "returned" | "writtenOff" | "holding", string>
>;

/**
 * The figure of a card that the cylinders on each type of bill count towards.
 * Opening stock counts towards none, being where a card starts from, and adding
 * cylinders names no party that has a card.
 */
export const CARD_FIGURES: Record<BillType, "sent" | "returned" | "writtenOff" | null> = {
  opening_stock: null,
  dispatch: "sent",
  send_to_refiller: "sent",
  return_from_refiller: "returned",
  return_from_customer: "returned",
  write_off: "writtenOff",
  add_cylinders: null,
};

/** A bill as a card lists it. */
const stockCardBillSchema = billSchema
  .pick({ id: true, type: true, paperKind: true, number: true, date: true, writeOffReason: true })
  .extend({
    /** One for each gas on it, in the order of the card's gases. */
    gases: z.array(stockCardLineSchema),
  });

export type StockCardBill = z.infer<typeof stockCardBillSchema>;

/** One month of a card, which may have no bills in it. */
export const stockCardMonthSchema = z.object({
  /** Such as "2026-11". */
  month: z.string().regex(/^\d{4}-\d{2}$/),
  /** One for each of the card's gases, in their order. */
  gases: z.array(stockCardFiguresSchema),
  /** Those of the month that are in the card's range, the oldest first. */
  bills: z.array(stockCardBillSchema),
});

export type StockCardMonth = z.infer<typeof stockCardMonthSchema>;

/** A statement of one customer's or refiller's cylinders over a range of dates. */
export const stockCardSchema = z.object({
  party: partySchema.pick({ id: true, name: true, active: true }).extend({
    type: z.enum(REGISTER_PARTY_TYPES),
  }),
  startDate: dateSchema.nullable(),
  from: dateSchema,
  to: dateSchema,
  /** Those it held as the range began, or that moved in it, in the order of the gases. */
  gases: z.array(cardGasSchema),
  /** What it held of each as the range began, opening stock included. */
  opening: z.array(gasHeldSchema),
  /** The oldest first. */
  months: z.array(stockCardMonthSchema),
  /** The whole range, with what was held as it ended. */
  closing: z.array(stockCardFiguresSchema),
});

export type StockCard = z.infer<typeof stockCardSchema>;
