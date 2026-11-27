import type { PendingReturnList } from "@gasflow/shared";
import { EmptyState } from "@/components/empty-state";
import { EmptyPage, Pagination } from "@/components/pagination";
import { PendingItem } from "@/components/pending-item";

/** A customer's bills with cylinders still out, the longest out first. */
export function PendingBills({
  list: { rows, total, page, pageSize },
  pageHref,
}: {
  list: PendingReturnList;
  pageHref: (page: number) => string;
}) {
  if (total === 0) {
    return <EmptyState>No cylinders are pending.</EmptyState>;
  }
  if (rows.length === 0) {
    return <EmptyPage firstPageHref={pageHref(1)} />;
  }
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
        {rows.map((row) => (
          <PendingItem
            key={`${row.bill.id} ${row.gas.id}`}
            row={row}
            count={`${row.pending} pending of ${row.sent}`}
          />
        ))}
      </ul>
      <Pagination
        page={page}
        pageSize={pageSize}
        shown={rows.length}
        total={total}
        pageHref={pageHref}
      />
    </div>
  );
}
