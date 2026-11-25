import { auth } from "@clerk/nextjs/server";
import type { Gas } from "@gasflow/shared";
import { LoadError } from "@/components/load-error";
import { fetchGases, orNull } from "@/lib/api";

export default async function GasesPage() {
  await auth.protect();
  const gases = (await orNull(fetchGases()))?.gases ?? null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Gases</h1>
        <p className="text-sm text-slate-500">The gases cylinders are counted by.</p>
      </div>
      <GasList gases={gases} />
    </div>
  );
}

function GasList({ gases }: { gases: Gas[] | null }) {
  if (gases === null) {
    return (
      <LoadError>
        The gases could not be loaded. Check that the API is running, then reload the page.
      </LoadError>
    );
  }
  if (gases.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        There are no gases yet. Run the database seed to add the starting list.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {gases.map((gas) => (
        <li key={gas.id} className="px-5 py-3 text-sm">
          {gas.name}
        </li>
      ))}
    </ul>
  );
}
