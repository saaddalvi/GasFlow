import type { PartyHolding } from "@gasflow/shared";
import { CylinderCount } from "@/components/cylinder-count";
import { EmptyState } from "@/components/empty-state";
import { formatMonth } from "@/lib/dates";

/** How many cylinders of each gas the party has. */
export function HoldsNow({ holding: { gases, total } }: { holding: PartyHolding }) {
  return (
    <section aria-labelledby="holds-heading" className="space-y-3">
      <h2 id="holds-heading" className="text-lg font-semibold">
        Holds now
      </h2>
      {gases.length === 0 ? (
        <EmptyState>Holds no cylinders.</EmptyState>
      ) : (
        <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
          {gases.map(({ gas, quantity }) => (
            <div key={gas.id} className="flex justify-between gap-4 px-5 py-3">
              <dt className="min-w-0 wrap-anywhere">{gas.name}</dt>
              <dd className="font-semibold">
                <CylinderCount count={quantity} />
              </dd>
            </div>
          ))}
          {/* With one gas, its own line already says it all. */}
          {gases.length > 1 && (
            <div className="flex justify-between gap-4 px-5 py-3 font-semibold">
              <dt>Total</dt>
              <dd>
                <CylinderCount count={total} />
              </dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}

/** What has been sent to the party and returned by it this month. */
export function ThisMonth({
  month: { from, sent, returned, netOut },
}: {
  month: PartyHolding["thisMonth"];
}) {
  const figures = [
    ["Sent", sent],
    ["Returned", returned],
    ["Net out", netOut],
  ] as const;

  return (
    <section aria-labelledby="month-heading" className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 id="month-heading" className="text-lg font-semibold">
          This month
        </h2>
        <p className="text-sm text-slate-500">{formatMonth(from)}</p>
      </div>
      <dl className="grid grid-cols-3 divide-x divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {figures.map(([label, count]) => (
          <div key={label} className="min-w-0 px-3 py-4 sm:px-5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {label}
            </dt>
            <dd className="text-3xl font-semibold tabular-nums wrap-anywhere">{count}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
