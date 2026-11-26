import { auth } from "@clerk/nextjs/server";
import {
  billName,
  PAPER_KIND_NAMES,
  whyNotCancel,
  type Bill,
  type BillParty,
  type Cancellation,
} from "@gasflow/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BillStatusTag } from "@/components/bill-status-tag";
import { buttonStyles } from "@/components/button-styles";
import { LoadError } from "@/components/load-error";
import { PageHeading } from "@/components/page-heading";
import { fetchBill, fetchMe, fetchToday, orNull } from "@/lib/api";
import { BILL_TYPE_NAMES, CANCEL_REASON_NAMES, FILL_STATE_NAMES } from "@/lib/bill-names";
import { formatDate, formatMoment } from "@/lib/dates";
import { BILL_PARTY_TYPE_NAMES } from "@/lib/party-types";
import { BILLS_PATH, NEW_BILL_PATH, OPENING_STOCK_PATH } from "@/lib/routes";
import { vehicleName } from "@/lib/vehicle-names";
import { CancelBill } from "./cancel-bill";
import { Returns } from "./returns";

export const metadata: Metadata = {
  title: "Bill · GasFlow",
};

export default async function BillPage({ params }: { params: Promise<{ billId: string }> }) {
  await auth.protect();
  const { billId } = await params;
  const [bill, me, today] = await Promise.all([
    orNull(fetchBill(billId)),
    orNull(fetchMe()),
    orNull(fetchToday()),
  ]);
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

  // Offered on a posted bill to those allowed to cancel it.
  const offerCancel = Boolean(
    bill.status === "posted" && me && today && whyNotCancel(bill, me, today) === null,
  );

  return (
    <div className="space-y-8">
      <PageHeading
        title={bill.number}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {BILL_TYPE_NAMES[bill.type]} · {formatDate(bill.date)}
            <BillStatusTag status={bill.status} />
          </span>
        }
      >
        <div className="flex flex-wrap items-center gap-4">
          {bill.type === "opening_stock" && (
            <Link href={OPENING_STOCK_PATH} className="text-sm text-brand-700 hover:underline">
              All opening stock
            </Link>
          )}
          <Link href={BILLS_PATH} className="text-sm text-brand-700 hover:underline">
            All bills
          </Link>
          <Link href={NEW_BILL_PATH} className={buttonStyles.secondary}>
            + New bill
          </Link>
        </div>
      </PageHeading>
      {bill.cancellation && <Cancelled cancellation={bill.cancellation} />}
      <Details bill={bill} />
      <Lines lines={bill.lines} />
      {bill.returns && <Returns returns={bill.returns} />}
      {/* Always here, so that a refusal stays up when it is no longer offered. Keyed,
          so that nothing typed on one bill is left on the next. */}
      <CancelBill key={bill.id} billId={bill.id} name={billName(bill)} offered={offerCancel} />
    </div>
  );
}

function Details({
  bill: { paperKind, slipNumber, from, to, vehicle, notes, enteredBy, enteredAt },
}: {
  bill: Bill;
}) {
  return (
    <DetailList
      details={[
        ["Paper kind", paperKind && PAPER_KIND_NAMES[paperKind]],
        ["Slip number", slipNumber],
        ["From", from && <PartyName party={from} />],
        // Opening stock names only the party that held it.
        [from ? "To" : "Party", to && <PartyName party={to} />],
        ["Vehicle", vehicle && vehicleName(vehicle)],
        ["Notes", notes && <Typed text={notes} />],
        ["Entered by", enteredBy.displayName],
        ["Entered at", formatMoment(enteredAt)],
      ]}
    />
  );
}

/** Who cancelled the bill, when and why. */
function Cancelled({
  cancellation: { reason, notes, cancelledBy, cancelledAt },
}: {
  cancellation: Cancellation;
}) {
  return (
    <section aria-labelledby="cancelled-heading" className="space-y-3">
      <div>
        <h2 id="cancelled-heading" className="text-lg font-semibold">
          Cancelled
        </h2>
        <p className="text-sm text-slate-500">This bill counts towards no figure.</p>
      </div>
      <DetailList
        details={[
          ["Reason", CANCEL_REASON_NAMES[reason]],
          ["Cancellation notes", notes && <Typed text={notes} />],
          ["Cancelled by", cancelledBy.displayName],
          ["Cancelled at", formatMoment(cancelledAt)],
        ]}
      />
    </section>
  );
}

/** Text kept on the lines it was typed on. */
function Typed({ text }: { text: string }) {
  return <span className="whitespace-pre-line">{text}</span>;
}

/** Labelled facts, leaving out those the bill has nothing for. */
function DetailList({ details }: { details: [label: string, value: React.ReactNode][] }) {
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
