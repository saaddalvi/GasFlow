import { auth } from "@clerk/nextjs/server";
import type { Vehicle } from "@gasflow/shared";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { ListSection } from "@/components/list-section";
import { LoadError } from "@/components/load-error";
import { PageHeading } from "@/components/page-heading";
import { Tag } from "@/components/tag";
import { fetchVehicles, orNull } from "@/lib/api";
import { AddVehicleForm, EditVehicleDialog } from "./vehicle-forms";

export const metadata: Metadata = {
  title: "Vehicles · GasFlow",
};

export default async function VehiclesPage() {
  await auth.protect();
  const list = await orNull(fetchVehicles({ inactive: true }));

  return (
    <div className="space-y-8">
      <PageHeading title="Vehicles" subtitle="What carries the cylinders." />
      {list ? (
        <>
          <AddVehicleForm />
          <Vehicles vehicles={list.vehicles} />
        </>
      ) : (
        <LoadError>
          The vehicles could not be loaded. Check that the API is running, then reload the page.
        </LoadError>
      )}
    </div>
  );
}

function Vehicles({ vehicles }: { vehicles: Vehicle[] }) {
  if (vehicles.length === 0) {
    return <EmptyState>There are no vehicles yet.</EmptyState>;
  }
  return (
    <ListSection title="All vehicles">
      {vehicles.map((vehicle) => (
        <li key={vehicle.id} className="flex items-center justify-between gap-3 px-5 py-3">
          <div className="min-w-0 text-sm">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              <span className="break-all">{vehicle.plate}</span>
              {!vehicle.active && <Tag>Inactive</Tag>}
            </p>
            {vehicle.label && <p className="break-words text-slate-500">{vehicle.label}</p>}
          </div>
          <EditVehicleDialog vehicle={vehicle} />
        </li>
      ))}
    </ListSection>
  );
}
