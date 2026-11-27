import { z } from "zod";
import { dateSchema } from "./date";
import { billSchema } from "./bill";
import { gasSchema } from "./gas";
import { partyListSchema, partySchema } from "./party";
import { queryDate, queryPage } from "./query";

/** Cylinders of one gas that a party holds. */
export const gasHeldSchema = z.object({
  gas: gasSchema.pick({ id: true, name: true }),
  /** Below zero when bills take away more than were there. */
  quantity: z.int(),
});

export type GasHeld = z.infer<typeof gasHeldSchema>;

/** What went out to a party and what came back, of every gas together. */
const movementSchema = z.object({
  /** By dispatch to a customer, or send to a refiller. */
  sent: z.int().nonnegative(),
  /** By return from a customer, matched or not, or from a refiller. */
  returned: z.int().nonnegative(),
  /** What was sent less what was returned, so below zero when more came back. */
  netOut: z.int(),
});

/** What a party holds now, and what has moved this month. A supplier has neither. */
export const partyHoldingSchema = z.object({
  /** One for each gas of which it holds any, or fewer than none. */
  gases: z.array(gasHeldSchema),
  /** Of every gas together, so gases below zero take from it. */
  total: z.int(),
  /** The calendar month it is in India, from its first day to its last. */
  thisMonth: movementSchema.extend({ from: dateSchema, to: dateSchema }),
});

export type PartyHolding = z.infer<typeof partyHoldingSchema>;

/** Which of a party's days to list. */
export const dailySummaryQuerySchema = z.object({
  /** The first and last dates wanted. */
  from: queryDate,
  to: queryDate,
  page: queryPage,
});

export type DailySummaryQuery = z.infer<typeof dailySummaryQuerySchema>;

/** One day on which cylinders were sent to a party or returned by it. */
export const movementDaySchema = movementSchema.extend({
  date: dateSchema,
  /** One for each gas that moved that day. */
  gases: z.array(
    movementSchema.pick({ sent: true, returned: true }).extend({ gas: gasHeldSchema.shape.gas }),
  ),
});

export type MovementDay = z.infer<typeof movementDaySchema>;

/** One page of a party's days, the newest first. */
export const dailySummarySchema = z.object({
  days: z.array(movementDaySchema),
  /** How many such days there are, on every page together. */
  total: z.int().nonnegative(),
  page: z.int().positive(),
  pageSize: z.int().positive(),
});

export type DailySummary = z.infer<typeof dailySummarySchema>;

/** A party as the party list shows it. */
export const reportedPartySchema = partySchema.extend({
  /** What it holds now. Null for a supplier, whose cylinders are not counted. */
  holding: partyHoldingSchema.pick({ gases: true, total: true }).nullable(),
  /** The latest-dated posted bill that names it, if any does. */
  lastBill: billSchema
    .pick({ id: true, type: true, paperKind: true, number: true, date: true })
    .nullable(),
});

export type ReportedParty = z.infer<typeof reportedPartySchema>;

/** The figures above the party list, which are of every party, listed or not. */
export const partySummarySchema = z.object({
  /** How many parties of each type are active. */
  active: z.object({
    customer: z.int().nonnegative(),
    refiller: z.int().nonnegative(),
    supplier: z.int().nonnegative(),
  }),
  /** Cylinders held by all customers together, of every gas. */
  withCustomers: z.int(),
  /** Cylinders held by all refillers together, of every gas. */
  atRefillers: z.int(),
  /** How many customers and refillers hold fewer than none of some gas. */
  belowZero: z.int().nonnegative(),
});

export type PartySummary = z.infer<typeof partySummarySchema>;

/** One page of the parties asked for, by name, under the figures for all of them. */
export const partyReportSchema = partyListSchema.extend({
  parties: z.array(reportedPartySchema),
  summary: partySummarySchema,
});

export type PartyReport = z.infer<typeof partyReportSchema>;
