import { auth } from "@clerk/nextjs/server";
import {
  billName,
  PAPER_KIND_NAMES,
  whyNotCancel,
  whyNotCorrect,
  whyUncorrectable,
  type Bill,
  type Cancellation,
} from "@gasflow/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BillStatusTag } from "@/components/bill-status-tag";
import { buttonStyles } from "@/components/button-styles";
import { LoadError } from "@/components/load-error";
import { PageHeading } from "@/components/page-heading";
import { Tag } from "@/components/tag";
import { fetchBill, fetchMe, fetchToday, orNull } from "@/lib/api";
import { BILL_TYPE_NAMES, CANCEL_REASON_NAMES } from "@/lib/bill-names";
import { formatDate, formatMoment } from "@/lib/dates";
import { BILLS_PATH, correctBillPath, NEW_BILL_PATH, OPENING_STOCK_PATH } from "@/lib/routes";
import { DetailList, Lines, movementDetails, Typed } from "./bill-parts";
import { CancelBill } from "./cancel-bill";
import { Returns } from "./returns";
import { Versions } from "./versions";

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

  // Each is offered on a posted bill to those allowed to do it.
  const posted = bill.status === "posted" && me && today ? { me, today } : null;
  const offerCancel = Boolean(posted && whyNotCancel(bill, posted.me, posted.today) === null);
  const offerCorrect = Boolean(
    posted && !whyUncorrectable(bill) && !whyNotCorrect(bill, posted.me, posted.today),
  );

  return (
    <div className="space-y-8">
      <PageHeading
        title={bill.number}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {BILL_TYPE_NAMES[bill.type]} · {formatDate(bill.date)}
            <BillStatusTag status={bill.status} />
            {bill.lastCorrection && <Tag colour="amber">Edited</Tag>}
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
          {offerCorrect && (
            <Link href={correctBillPath(bill.id)} className={buttonStyles.secondary}>
              Correct bill
            </Link>
          )}
          <Link href={NEW_BILL_PATH} className={buttonStyles.secondary}>
            + New bill
          </Link>
        </div>
      </PageHeading>
      {bill.cancellation && <Cancelled cancellation={bill.cancellation} />}
      <Details bill={bill} />
      <Lines lines={bill.lines} />
      {bill.returns && <Returns returns={bill.returns} />}
      {bill.lastCorrection && (
        <Versions
          type={bill.type}
          earlier={bill.earlierVersions}
          lastCorrection={bill.lastCorrection}
        />
      )}
      {/* Always here, so that a refusal stays up when it is no longer offered. Keyed,
          so that nothing typed on one bill is left on the next. */}
      <CancelBill key={bill.id} billId={bill.id} name={billName(bill)} offered={offerCancel} />
    </div>
  );
}

function Details({ bill }: { bill: Bill }) {
  const { paperKind, slipNumber, enteredBy, enteredAt } = bill;

  return (
    <DetailList
      details={[
        ["Paper kind", paperKind && PAPER_KIND_NAMES[paperKind]],
        ["Slip number", slipNumber],
        ...movementDetails(bill),
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
