import { z } from "zod";

export const gasSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
});

export type Gas = z.infer<typeof gasSchema>;

export const gasListSchema = z.object({
  gases: z.array(gasSchema),
});

export type GasList = z.infer<typeof gasListSchema>;
