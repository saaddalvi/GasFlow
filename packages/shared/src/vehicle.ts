import { z } from "zod";
import { queryFlag } from "./query";
import { optionalText, requiredText } from "./text";

export const vehicleSchema = z.object({
  id: z.uuid(),
  plate: z.string().min(1),
  label: z.string().nullable(),
  /** An inactive vehicle is not offered on anything new. */
  active: z.boolean(),
});

export type Vehicle = z.infer<typeof vehicleSchema>;

/** A vehicle by its plate, with its label if it has one. */
export function vehicleName({ plate, label }: Pick<Vehicle, "plate" | "label">): string {
  return label ? `${plate} (${label})` : plate;
}

/** What can be filled in about a vehicle. */
const vehicleFields = {
  plate: requiredText({
    missing: "Enter the number plate.",
    max: 20,
    tooLong: "Use a number plate of at most 20 characters.",
  }),
  label: optionalText({ max: 100, tooLong: "Use a label of at most 100 characters." }),
  active: z.boolean("Say whether the vehicle is active."),
};

export const newVehicleSchema = z.object({
  plate: vehicleFields.plate,
  label: vehicleFields.label.default(null),
  active: vehicleFields.active.default(true),
});

export type NewVehicle = z.infer<typeof newVehicleSchema>;

/** A change to a vehicle: only what it mentions is changed. */
export const vehicleChangesSchema = z.object(vehicleFields).partial();

export type VehicleChanges = z.infer<typeof vehicleChangesSchema>;

/** Which vehicles to list. */
export const vehicleListQuerySchema = z.object({
  /** Whether to include inactive vehicles. Pickers leave this off. */
  inactive: queryFlag,
});

export type VehicleListQuery = z.infer<typeof vehicleListQuerySchema>;

export const vehicleListSchema = z.object({
  vehicles: z.array(vehicleSchema),
});

export type VehicleList = z.infer<typeof vehicleListSchema>;
