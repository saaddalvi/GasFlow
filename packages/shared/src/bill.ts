import { z } from "zod";
import { dateSchema } from "./date";
import { gasSchema } from "./gas";
import { PARTY_TYPES } from "./party";

export const FILL_STATES = ["filled", "empty", "defective"] as const;

export const fillStateSchema = z.enum(FILL_STATES, "Choose filled, empty or defective.");

export type FillState = z.infer<typeof fillStateSchema>;

export const billTypeSchema = z.enum(["opening_stock"]);

export type BillType = z.infer<typeof billTypeSchema>;

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

/** A bill with everything on it. */
export const billSchema = z.object({
  id: z.uuid(),
  type: billTypeSchema,
  number: z.string().min(1),
  date: dateSchema,
  /** Only posted bills count. */
  status: z.enum(["posted", "cancelled"]),
  /** Whom the cylinders leave, or null when they join the business. */
  from: billPartySchema.nullable(),
  /** Who receives them, or null when they leave the business. */
  to: billPartySchema.nullable(),
  lines: z.array(
    z.object({
      id: z.uuid(),
      gas: gasSchema.pick({ id: true, name: true }),
      fillState: fillStateSchema,
      quantity: z.int().positive(),
    }),
  ),
  enteredBy: billStaffSchema,
  enteredAt: z.iso.datetime(),
});

export type Bill = z.infer<typeof billSchema>;

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
