import type { Bill, BillContent, BillParty } from "@gasflow/shared";
import Link from "next/link";
import { FILL_STATE_NAMES } from "@/lib/bill-names";
import { BILL_PARTY_TYPE_NAMES } from "@/lib/party-types";
import { vehicleName } from "@/lib/vehicle-names";

// The parts a bill is shown in, as it stands and as it stood before a correction.

/** Labelled facts, leaving out those the bill has nothing for. */
export function DetailList({ details }: { details: [label: string, value: React.ReactNode][] }) {
  return (
    <dl className="max-w-2xl divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {details.map(
        ([label, value]) =>
          value && (
            <div key={label} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[10rem_1fr]">
              <dt className="text-slate-500">{label}</dt>
              <dd className="wrap-anywhere">{value}</dd>
            </div>
          ),
      )}
    </dl>
  );
}

/** Who the cylinders moved between, what carried them and what was noted. */
export function movementDetails({
  from,
  to,
  vehicle,
  notes,
}: Pick<BillContent, "from" | "to" | "vehicle" | "notes">): [string, React.ReactNode][] {
  return [
    ["From", from && <PartyName party={from} />],
    // Opening stock names only the party that held it.
    [from ? "To" : "Party", to && <PartyName party={to} />],
    ["Vehicle", vehicle && vehicleName(vehicle)],
    ["Notes", notes && <Typed text={notes} />],
  ];
}

/** Text kept on the lines it was typed on. */
export function Typed({ text }: { text: string }) {
  return <span className="whitespace-pre-line">{text}</span>;
}

/** A party's name and type, linked to its page. The shop has none. */
function PartyName({ party: { id, name, type } }: { party: BillParty }) {
  return (
    <>
      {type === "shop" ? (
        name
      ) : (
        <Link href={`/parties/${id}`} className="text-brand-700 hover:underline">
          {name}
        </Link>
      )}{" "}
      <span className="text-slate-500">({BILL_PARTY_TYPE_NAMES[type]})</span>
    </>
  );
}

export function Lines({ lines }: { lines: Bill["lines"] }) {
  const total = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div className="max-w-2xl overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th scope="col" className="px-5 py-3 font-semibold">
              Gas
            </th>
            <th scope="col" className="px-3 py-3 font-semibold">
              Fill state
            </th>
            <th scope="col" className="px-5 py-3 text-right font-semibold">
              Quantity
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lines.map((line) => (
            <tr key={line.id}>
              <td className="px-5 py-3">{line.gas.name}</td>
              <td className="px-3 py-3">{FILL_STATE_NAMES[line.fillState]}</td>
              <td className="px-5 py-3 text-right tabular-nums">{line.quantity}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-slate-200 font-semibold">
          <tr>
            <th scope="row" colSpan={2} className="px-5 py-3">
              Total
            </th>
            <td className="px-5 py-3 text-right tabular-nums">{total}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
