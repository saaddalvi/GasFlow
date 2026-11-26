import type { BillReturns } from "@gasflow/shared";
import Link from "next/link";
import { ReturnStatusTag } from "@/components/return-status-tag";
import { quantitiesByGas } from "@/lib/bill-names";
import { formatDate } from "@/lib/dates";
import { billPath } from "@/lib/routes";

/** How much of a bill has come back, and on which returns. */
export function Returns({
  returns: { sent, returned, pending, status, gases, entries },
}: {
  returns: BillReturns;
}) {
  return (
    <section aria-labelledby="returns-heading" className="max-w-2xl space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="returns-heading" className="text-lg font-semibold">
          Returns
        </h2>
        <ReturnStatusTag status={status} />
      </div>
      <p className="text-sm font-medium tabular-nums">
        Sent {sent} · Returned {returned} · Pending {pending}
      </p>
      {/* With one gas, the line above already says it all. */}
      {gases.length > 1 && <ByGas gases={gases} />}
      {entries.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          Nothing has been returned against this bill yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 px-5 py-3">
              <div className="min-w-0 wrap-anywhere">
                <Link
                  href={billPath(entry.id)}
                  className="font-medium text-brand-700 tabular-nums hover:underline"
                >
                  {entry.number}
                </Link>{" "}
                <span className="text-slate-500">· {formatDate(entry.date)}</span>
                <p className="text-slate-500">Entered by {entry.enteredBy.displayName}</p>
              </div>
              <div className="text-right tabular-nums">
                <p className="font-semibold">{entry.quantity} returned</p>
                <p className="text-slate-500">{quantitiesByGas(entry.gases)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ByGas({ gases }: { gases: BillReturns["gases"] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th scope="col" className="px-5 py-3 font-semibold">
              Gas
            </th>
            {["Sent", "Returned", "Pending"].map((heading) => (
              <th key={heading} scope="col" className="px-3 py-3 text-right font-semibold">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 tabular-nums">
          {gases.map(({ gas, sent, returned, pending }) => (
            <tr key={gas.id}>
              <td className="px-5 py-3">{gas.name}</td>
              <td className="px-3 py-3 text-right">{sent}</td>
              <td className="px-3 py-3 text-right">{returned}</td>
              <td className="px-3 py-3 text-right font-semibold">{pending}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
