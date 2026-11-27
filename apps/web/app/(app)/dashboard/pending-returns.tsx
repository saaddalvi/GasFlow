import type { Dashboard } from "@gasflow/shared";
import { PENDING_RETURNS_PATH } from "@/lib/routes";
import { BigCount, called, CardLabel, counted, LinkCard } from "./parts";

/** The cylinders customers have yet to return, and how many of them are overdue. */
export function PendingReturns({ quantity, customers, overdue }: Dashboard["pendingReturns"]) {
  return (
    <LinkCard href={PENDING_RETURNS_PATH}>
      <CardLabel>Pending returns</CardLabel>
      <BigCount count={quantity} />
      <span className="block text-sm text-slate-500">
        {called(quantity, "cylinder")} pending from {counted(customers, "customer")}
      </span>
      <span
        className={`mt-2 block text-sm font-medium tabular-nums ${
          overdue > 0 ? "text-rose-700" : "text-slate-500"
        }`}
      >
        {overdue > 0 ? `${overdue} overdue` : "None overdue"}
      </span>
    </LinkCard>
  );
}
