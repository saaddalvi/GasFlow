import { z } from "zod";
import { dateSchema } from "./date";

export const startDateSchema = z.object({
  /** The date from which the records begin, or null until an admin sets it. */
  startDate: dateSchema.nullable(),
});

export type StartDate = z.infer<typeof startDateSchema>;

export const newStartDateSchema = z.object({
  date: z.iso
    .date("Choose the start date.")
    .refine((date) => date >= "2000-01-01", "Use a date in 2000 or later."),
});

export type NewStartDate = z.infer<typeof newStartDateSchema>;
