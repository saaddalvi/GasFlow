import { auth } from "@clerk/nextjs/server";
import type { Bill, BillParty } from "@gasflow/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LoadError } from "@/components/load-error";
import { PageHeading } from "@/components/page-heading";
import { Tag } from "@/components/tag";
import { fetchBill, orNull } from "@/lib/api";
import { BILL_TYPE_NAMES, FILL_STATE_NAMES } from "@/lib/bill-names";
import { formatDate, formatMoment } from "@/lib/dates";
import { BILL_PARTY_TYPE_NAMES } from "@/lib/party-types";
import { OPENING_STOCK_PATH } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Bill · GasFlow",
};

export default async function BillPage({ params }: { params: Promise<{ billId: string }> }) {
  await auth.protect();
  const { billId } = await params;
  const bill = await orNull(fetchBill(billId));
  if (bill === undefined) {
    notFound();
  }
  if (bill === null) {
    return (
      <LoadError>
        The bill could not be loaded. Check that the API is running, then reload the page.
      </LoadError>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeading
        title={bill.number}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {BILL_TYPE_NAMES[bill.type]} · {formatDate(bill.date)}
            <Tag colour={bill.status === "posted" ? "green" : "grey"}>
              {bill.status === "posted" ? "Posted" : "Cancelled"}
            </Tag>
          </span>
        }
      >
        <Link href={OPENING_STOCK_PATH} className="text-sm text-brand-700 hover:underline">
          All opening stock
        </Link>
      </PageHeading>
      <Details bill={bill} />
      <Lines lines={bill.lines} />
    </div>
  );
}

function Details({ bill: { from, to, enteredBy, enteredAt } }: { bill: Bill }) {
  const details = [
    ["From", from && <PartyName party={from} />],
    // Opening stock names only the party that held it.
    [from ? "To" : "Party", to && <PartyName party={to} />],
    ["Entered by", enteredBy.displayName],
    ["Entered at", formatMoment(enteredAt)],
  ] as const;

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

function Lines({ lines }: { lines: Bill["lines"] }) {
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
