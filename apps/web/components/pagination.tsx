import Link from "next/link";
import { buttonStyles } from "./button-styles";
import { EmptyState } from "./empty-state";

/** Under a long list: which rows are shown, and the way to the other pages. */
export function Pagination({
  page,
  pageSize,
  shown,
  total,
  pageHref,
}: {
  page: number;
  pageSize: number;
  /** How many rows are on this page. */
  shown: number;
  total: number;
  pageHref: (page: number) => string;
}) {
  const first = (page - 1) * pageSize + 1;
  const last = first + shown - 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
      <p className="tabular-nums">
        {first} to {last} of {total}
      </p>
      <nav aria-label="Pages" className="flex gap-2">
        {page > 1 && (
          <Link href={pageHref(page - 1)} className={buttonStyles.secondary}>
            Previous
          </Link>
        )}
        {last < total && (
          <Link href={pageHref(page + 1)} className={buttonStyles.secondary}>
            Next
          </Link>
        )}
      </nav>
    </div>
  );
}

/** For a page past the end of a list that has something in it. */
export function EmptyPage({ firstPageHref }: { firstPageHref: string }) {
  return (
    <EmptyState>
      There is nothing on this page.{" "}
      <Link href={firstPageHref} className="text-brand-700 underline">
        Go to the first page
      </Link>
    </EmptyState>
  );
}
