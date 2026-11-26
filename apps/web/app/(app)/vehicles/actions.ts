"use server";

import type { NewVehicle, VehicleChanges } from "@gasflow/shared";
import { sendChange, type Outcome } from "@/lib/api";

// What the Vehicles screen asks for. The API checks every value.

export async function addVehicle(vehicle: NewVehicle): Promise<Outcome> {
  return sendChange("POST", "/api/vehicles", vehicle);
}

export async function saveVehicle(vehicleId: string, changes: VehicleChanges): Promise<Outcome> {
  return sendChange("PATCH", `/api/vehicles/${encodeURIComponent(vehicleId)}`, changes);
}
