import type { Dashboard } from "@gasflow/shared";
import Link from "next/link";
import { formatTime } from "@/lib/dates";
import { BelowZero } from "./below-zero";
import { DispatchedCard } from "./dispatched-card";
import {
  BigCount,
  billsOfDayHref,
  Card,
  CardLabel,
  counted,
  GasChips,
  LinkCard,
  postedBillsHref,
  Section,
} from "./parts";
import { PendingReturns } from "./pending-returns";

/** What has moved today, what has been entered, and what ought to be looked into. */
export function Today({ dashboard, startDate }: { dashboard: Dashboard; startDate: string }) {
  const { date, dispatched, received, netOut, billsEntered } = dashboard;

  return (
    <Section label="Today">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DispatchedCard
            date={date}
            startDate={startDate}
            dispatched={dispatched}
            className="sm:col-span-2 lg:row-span-2"
          />
          <Card>
            <Link href={billsOfDayHref("return_from_customer", date)} className="group block">
              <CardLabel>Received from customers</CardLabel>
              <span className="group-hover:underline">
                <BigCount count={received.quantity} />
              </span>
              <GasChips gases={received.gases} />
            </Link>
            <p className="mt-3 text-sm text-slate-500">
              <span className="font-medium text-slate-700">Net out today: {netOut}.</span>{" "}
              {netOutInWords(netOut, dispatched.quantity)}
            </p>
          </Card>
          <LinkCard href={postedBillsHref({ enteredOn: date })}>
            <CardLabel>Bills entered</CardLabel>
            <BigCount count={billsEntered.count} />
            <span className="block text-sm text-slate-500">
              {billsEntered.lastEnteredAt
                ? `Last at ${formatTime(billsEntered.lastEnteredAt)}`
                : "None yet today"}
            </span>
          </LinkCard>
          <PendingReturns {...dashboard.pendingReturns} />
          <BelowZero {...dashboard.belowZero} />
        </div>
        <Refillers date={date} movements={dashboard.refillerMovements} />
      </div>
    </Section>
  );
}

/** What dispatched less received comes to, in plain words. */
function netOutInWords(netOut: number, dispatched: number): string {
  if (netOut > 0) {
    return `${counted(netOut, "more cylinder")} went out than came back.`;
  }
  if (netOut < 0) {
    return `${counted(-netOut, "more cylinder")} came back than went out.`;
  }
  return dispatched === 0 ? "Nothing has gone out or come back." : "As many came back as went out.";
}

/** Cylinders that went to refillers today and came back from them, on one line. */
function Refillers({
  date,
  movements: { sent, received },
}: {
  date: string;
  movements: Dashboard["refillerMovements"];
}) {
  const link = "rounded-md py-1 hover:underline";
  const figure = "text-lg font-semibold tabular-nums";

  return (
    <p className="flex flex-wrap items-baseline gap-x-4 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm">
      <span className="font-medium text-slate-600">Refillers</span>
      <Link href={billsOfDayHref("send_to_refiller", date)} className={link}>
        <span className={figure}>{sent}</span> sent for refill
      </Link>
      <Link href={billsOfDayHref("return_from_refiller", date)} className={link}>
        <span className={figure}>{received}</span> received back
      </Link>
    </p>
  );
}
