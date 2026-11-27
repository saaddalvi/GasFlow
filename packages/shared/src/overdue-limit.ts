import { z } from "zod";

export const overdueLimitSchema = z.object({
  /** Cylinders are overdue once their days out exceed this many. */
  days: z.int().positive(),
});

export type OverdueLimit = z.infer<typeof overdueLimitSchema>;

/** Ten years, far past any practice, so that a slip of typing is caught. */
export const MOST_OVERDUE_DAYS = 3650;

const WHOLE_DAYS = "Enter the overdue limit as a whole number of days.";

export const newOverdueLimitSchema = z.object({
  days: z
    .number(WHOLE_DAYS)
    .int(WHOLE_DAYS)
    .min(1, "Use an overdue limit of 1 day or more.")
    .max(MOST_OVERDUE_DAYS, `Use an overdue limit of at most ${MOST_OVERDUE_DAYS} days.`),
});

export type NewOverdueLimit = z.infer<typeof newOverdueLimitSchema>;
