import type { NewVehicle, VehicleChanges, VehicleListQuery } from "@gasflow/shared";
import type { Database } from "../database";
import { Refusal } from "../refusal";

/** Vehicles by plate. */
export function listVehicles(db: Database, { inactive }: VehicleListQuery) {
  return db.vehicle.findMany({
    where: { active: inactive ? undefined : true },
    select: VEHICLE,
    orderBy: [{ plate: "asc" }, { id: "asc" }],
  });
}

export function createVehicle(db: Database, vehicle: NewVehicle) {
  return db.vehicle.create({ data: vehicle, select: VEHICLE });
}

/** Changes what is mentioned. */
export async function changeVehicle(db: Database, vehicleId: string, changes: VehicleChanges) {
  // Vehicles are never deleted, so one that is found here is still there below.
  if (!(await db.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } }))) {
    throw noSuchVehicle();
  }
  return db.vehicle.update({ where: { id: vehicleId }, data: changes, select: VEHICLE });
}

export function noSuchVehicle(): Refusal {
  return new Refusal(404, "There is no such vehicle.");
}

/** The columns the API reports for a vehicle. */
const VEHICLE = { id: true, plate: true, label: true, active: true } as const;
