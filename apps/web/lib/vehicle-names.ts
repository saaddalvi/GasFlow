import type { Vehicle } from "@gasflow/shared";

/** A vehicle by its plate, with its label if it has one. */
export function vehicleName({ plate, label }: Pick<Vehicle, "plate" | "label">): string {
  return label ? `${plate} (${label})` : plate;
}
