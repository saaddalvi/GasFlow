import { z } from "zod";

/** A bill that has to be dealt with before what was asked can be done. */
export const blockingBillSchema = z.object({ id: z.uuid(), number: z.string().min(1) });

export type BlockingBill = z.infer<typeof blockingBillSchema>;

/** What the API answers when it turns a request down. */
export const refusalSchema = z.object({
  /** Why, in words fit to show the person who asked. */
  message: z.string(),
  /** The bills that stand in the way, for the person to be led to. Not on most refusals. */
  blockingBills: z.array(blockingBillSchema).optional(),
});
