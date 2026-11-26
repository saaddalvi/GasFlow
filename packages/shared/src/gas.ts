import { z } from "zod";
import { queryFlag } from "./query";
import { requiredText } from "./text";

export const gasSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  /** False once the gas is retired: it is not offered on anything new. */
  active: z.boolean(),
});

export type Gas = z.infer<typeof gasSchema>;

export const gasListSchema = z.object({
  gases: z.array(gasSchema),
});

export type GasList = z.infer<typeof gasListSchema>;

/** Which gases to list. */
export const gasListQuerySchema = z.object({
  /** Whether to include retired gases. Pickers leave this off. */
  retired: queryFlag,
});

export type GasListQuery = z.infer<typeof gasListQuerySchema>;

const name = requiredText({
  missing: "Enter the gas's name.",
  max: 50,
  tooLong: "Use a name of at most 50 characters.",
});

export const newGasSchema = z.object({ name });

export type NewGas = z.infer<typeof newGasSchema>;

/** A rename, a retirement or a retired gas brought back. */
export const gasChangesSchema = z.object({
  name: name.optional(),
  active: z.boolean("Say whether the gas is in use.").optional(),
});

export type GasChanges = z.infer<typeof gasChangesSchema>;
