import { z } from "zod";
import { optionalChoice, queryFlag, queryPage } from "./query";
import { optionalText, requiredText, text } from "./text";

/** The parties staff maintain. The shop is a party too, but only setup creates it. */
export const PARTY_TYPES = ["customer", "refiller", "supplier"] as const;

export const partyTypeSchema = z.enum(PARTY_TYPES, "Choose customer, refiller or supplier.");

export type PartyType = z.infer<typeof partyTypeSchema>;

/** The parties whose cylinders are counted. A supplier holds none. */
export const HOLDER_TYPES = ["shop", "customer", "refiller"] as const;

export type HolderType = (typeof HOLDER_TYPES)[number];

/** Whether the cylinders of a party of this type are counted. */
export function holdsCylinders(type: PartyType | HolderType): boolean {
  return HOLDER_TYPES.some((holder) => holder === type);
}

export const partySchema = z.object({
  id: z.uuid(),
  type: partyTypeSchema,
  name: z.string().min(1),
  abbreviation: z.string().min(1),
  mobile: z.string().nullable(),
  contactPerson: z.string().nullable(),
  address: z.string().nullable(),
  notes: z.string().nullable(),
  /** An inactive party is not offered on anything new. */
  active: z.boolean(),
});

export type Party = z.infer<typeof partySchema>;

/** What can be filled in about a party. */
const partyFields = {
  name: requiredText({
    missing: "Enter the party's name.",
    max: 100,
    tooLong: "Use a name of at most 100 characters.",
  }),
  abbreviation: optionalText({
    max: 10,
    tooLong: "Use an abbreviation of at most 10 characters.",
  }),
  mobile: optionalText({ max: 30, tooLong: "Use a mobile number of at most 30 characters." }),
  contactPerson: optionalText({
    max: 100,
    tooLong: "Use a contact person of at most 100 characters.",
  }),
  address: optionalText({ max: 500, tooLong: "Use an address of at most 500 characters." }),
  notes: optionalText({ max: 1000, tooLong: "Use notes of at most 1000 characters." }),
  active: z.boolean("Say whether the party is active."),
};

export const newPartySchema = z.object({
  type: partyTypeSchema,
  name: partyFields.name,
  abbreviation: partyFields.abbreviation.default(null),
  mobile: partyFields.mobile.default(null),
  contactPerson: partyFields.contactPerson.default(null),
  address: partyFields.address.default(null),
  notes: partyFields.notes.default(null),
  active: partyFields.active.default(true),
});

export type NewParty = z.infer<typeof newPartySchema>;

/**
 * A change to a party: only what it mentions is changed. A party keeps the type
 * it was added with.
 */
export const partyChangesSchema = z.object(partyFields).partial();

export type PartyChanges = z.infer<typeof partyChangesSchema>;

/** Which parties to list. */
export const partyListQuerySchema = z.object({
  /** Part of a name, in any capitals. */
  search: text("Search for one name at a time.").optional(),
  type: optionalChoice(partyTypeSchema),
  /** Whether to include inactive parties. Pickers leave this off. */
  inactive: queryFlag,
  page: queryPage,
});

export type PartyListQuery = z.infer<typeof partyListQuerySchema>;

/** One page of parties, by name. */
export const partyListSchema = z.object({
  parties: z.array(partySchema),
  /** How many parties match, on every page together. */
  total: z.int().nonnegative(),
  page: z.int().positive(),
  pageSize: z.int().positive(),
});

export type PartyList = z.infer<typeof partyListSchema>;
