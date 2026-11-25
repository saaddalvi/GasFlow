import { z } from "zod";

/** A staff member as the API knows them. */
export const staffSchema = z.object({
  id: z.uuid(),
  displayName: z.string().min(1),
  isAdmin: z.boolean(),
});

export type Staff = z.infer<typeof staffSchema>;
