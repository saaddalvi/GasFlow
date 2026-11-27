import { z } from "zod";
import { dateSchema } from "./date";
import { gasHeldSchema } from "./holding";
import { partySchema } from "./party";
import { optionalChoice, queryDate, queryPage, querySearch } from "./query";

/** The parties whose holdings are registered: those cylinders go out to. */
export const REGISTER_PARTY_TYPES = ["customer", "refiller"] as const;

const registerPartyTypeSchema = z.enum(REGISTER_PARTY_TYPES, "Choose customer or refiller.");

/** Whether to list only parties holding cylinders, or fewer than none, or every party. */
export const REGISTER_SHOWS = ["non_zero", "all"] as const;

export const balanceRegisterQuerySchema = z.object({
  /** The day to report as it ended. Left out, it is today. */
  date: queryDate,
  type: optionalChoice(registerPartyTypeSchema),
  show: optionalChoice(z.enum(REGISTER_SHOWS, "Choose non-zero or all.")).transform(
    (show) => show ?? "non_zero",
  ),
  /** Part of a name, in any capitals. */
  search: querySearch,
  page: queryPage,
});

export type BalanceRegisterQuery = z.infer<typeof balanceRegisterQuerySchema>;

/** A customer or refiller, with what it held as a day ended. */
export const registerPartySchema = partySchema.pick({ id: true, name: true, active: true }).extend({
  type: registerPartyTypeSchema,
  /** One for each gas of which it held any, or fewer than none. */
  gases: z.array(gasHeldSchema),
  /** Of every gas together, so gases below zero take from it. */
  total: z.int(),
});

export type RegisterParty = z.infer<typeof registerPartySchema>;

/** What customers and refillers held as one day ended. */
export const balanceRegisterSchema = z.object({
  date: dateSchema,
  startDate: dateSchema.nullable(),
  /** One page of them, by name. */
  parties: z.array(registerPartySchema),
  /** Of all the parties listed, on every page together. */
  summary: z.object({
    /** Cylinders they hold, of every gas. */
    held: z.int(),
    /** How many of them hold fewer than none of some gas. */
    belowZero: z.int().nonnegative(),
  }),
  /** How many parties are listed, on every page together. */
  total: z.int().nonnegative(),
  page: z.int().positive(),
  pageSize: z.int().positive(),
});

export type BalanceRegister = z.infer<typeof balanceRegisterSchema>;
