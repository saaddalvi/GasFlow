"use client";

import { closedRowListSchema } from "@gasflow/shared";
import { useState } from "react";
import { buttonStyles } from "@/components/button-styles";
import { RECEIVE_EMPTIES_PATH } from "@/lib/routes";
import { useLookup } from "@/lib/use-lookup";
import { LoadState } from "./load-state";
import { RowCounts, RowHeading } from "./row-heading";

const linkStyles = "text-sm text-brand-700 hover:underline";

/**
 * The rows with nothing pending, hidden until asked for. Give it a key of its
 * customer, so that it starts afresh for another.
 */
export function ClosedRows({
  customerId,
  date,
  askAgain,
}: {
  customerId: string;
  date: string;
  /** Changes when the rows may have changed. */
  askAgain: number;
}) {
  const [shown, setShown] = useState(false);
  const [page, setPage] = useState(1);
  const [retries, setRetries] = useState(0);
  // A different date may leave fewer pages.
  const [pagedDate, setPagedDate] = useState(date);
  if (date !== pagedDate) {
    setPagedDate(date);
    setPage(1);
  }
  const query = new URLSearchParams({ customerId, date, page: String(page) });
  const answer = useLookup(
    shown ? `${RECEIVE_EMPTIES_PATH}/closed?${query.toString()}` : null,
    closedRowListSchema,
    askAgain + retries,
  );
  const list = answer?.data;

  if (!shown) {
    return (
      <button type="button" onClick={() => setShown(true)} className={linkStyles}>
        Show closed bills
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => setShown(false)} className={linkStyles}>
        Hide closed bills
      </button>
      {!list ? (
        <LoadState
          what="closed bills"
          failed={answer?.failed}
          onRetry={() => setRetries(retries + 1)}
        />
      ) : list.total === 0 ? (
        <p className="text-sm text-slate-500">No bill is closed as of this date.</p>
      ) : (
        <>
          <ul
            aria-label="Closed bills"
            className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50 text-sm"
          >
            {list.rows.map((row) => (
              <li
                key={`${row.bill.id} ${row.gas.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <RowHeading row={row} />
                {/* Not tagged: another gas on the bill may still be pending. */}
                <RowCounts row={row} />
              </li>
            ))}
          </ul>
          {list.total > list.pageSize && (
            <nav aria-label="Pages of closed bills" className="flex items-center gap-3 text-sm">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className={buttonStyles.secondary}
              >
                Newer
              </button>
              <span className="tabular-nums">
                Page {page} of {Math.ceil(list.total / list.pageSize)}
              </span>
              <button
                type="button"
                disabled={page * list.pageSize >= list.total}
                onClick={() => setPage(page + 1)}
                className={buttonStyles.secondary}
              >
                Older
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
