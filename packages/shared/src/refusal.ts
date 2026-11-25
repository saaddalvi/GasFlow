import { z } from "zod";

/** What the API answers when it turns a request down. */
export const refusalSchema = z.object({
  /** Why, in words fit to show the person who asked. */
  message: z.string(),
});
