import { auth } from "@clerk/nextjs/server";
import type { Gas } from "@gasflow/shared";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { ListSection } from "@/components/list-section";
import { LoadError } from "@/components/load-error";
import { PageHeading } from "@/components/page-heading";
import { fetchGases, fetchMe, orNull } from "@/lib/api";
import { AddGasForm, GasActions } from "./gas-forms";

export const metadata: Metadata = {
  title: "Gases · GasFlow",
};

export default async function GasesPage() {
  await auth.protect();
  // Only admins change the list, so only they see retired gases. The API refuses
  // everyone else whatever is shown here.
  const isAdmin = (await orNull(fetchMe()))?.isAdmin ?? false;
  const list = await orNull(fetchGases({ retired: isAdmin }));

  return (
    <div className="space-y-8">
      <PageHeading title="Gases" subtitle="The gases cylinders are counted by." />
      {list ? (
        <>
          {isAdmin && <AddGasForm />}
          <Gases gases={list.gases} isAdmin={isAdmin} />
        </>
      ) : (
        <LoadError>
          The gases could not be loaded. Check that the API is running, then reload the page.
        </LoadError>
      )}
    </div>
  );
}

function Gases({ gases, isAdmin }: { gases: Gas[]; isAdmin: boolean }) {
  const retired = gases.filter((gas) => !gas.active);
  const inUse = gases.filter((gas) => gas.active);

  return (
    <>
      {inUse.length > 0 ? (
        <GasSection title="In use" gases={inUse} isAdmin={isAdmin} />
      ) : (
        <EmptyState>There are no gases in use.</EmptyState>
      )}
      {retired.length > 0 && <GasSection title="Retired" gases={retired} isAdmin={isAdmin} />}
    </>
  );
}

function GasSection({ title, gases, isAdmin }: { title: string; gases: Gas[]; isAdmin: boolean }) {
  return (
    <ListSection title={title}>
      {gases.map((gas) => (
        <li key={gas.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <span className="min-w-0 break-words text-sm">{gas.name}</span>
          {isAdmin && <GasActions gas={gas} />}
        </li>
      ))}
    </ListSection>
  );
}
