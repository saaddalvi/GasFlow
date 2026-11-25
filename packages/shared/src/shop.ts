import { z } from "zod";

export const shopSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
});

export type Shop = z.infer<typeof shopSchema>;
