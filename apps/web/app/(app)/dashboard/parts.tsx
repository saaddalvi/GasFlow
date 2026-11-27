import { billListQuerySchema, type BillListQuery, type GasHeld } from "@gasflow/shared";
import Link from "next/link";
import { useId } from "react";
import { billListSearch } from "@/lib/bill-list-search";
import { BILLS_PATH } from "@/lib/routes";

// What the parts of the dashboard have in common.

/** The list of the posted bills behind a figure. Cancelled bills count in none. */
export function postedBillsHref(
  filters: Partial<Pick<BillListQuery, "type" | "from" | "to" | "enteredOn">>,
): string {
  const query = { ...billListQuerySchema.parse({}), status: "posted" as const, ...filters };
  return `${BILLS_PATH}?${billListSearch(query)}`;
}

/** The list of the posted bills of one type dated on one day. */
export function billsOfDayHref(type: BillListQuery["type"], date: string): string {
  return postedBillsHref({ type, from: date, to: date });
}

/** What so many are called, such as "customer" or "customers". */
export function called(count: number, one: string): string {
  return Math.abs(count) === 1 ? one : `${one}s`;
}

/** "1 customer", "2 customers". */
export function counted(count: number, one: string): string {
  return `${count} ${called(count, one)}`;
}

/** Part of the dashboard, under its label. */
export function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h2 id={headingId} className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </h2>
      {children}
    </section>
  );
}

const CARD = "min-w-0 rounded-xl border border-slate-200 bg-white p-5";

/** A card with links of its own inside it. */
export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`${CARD} ${className}`}>{children}</div>;
}

/** A card that is one link to the list behind its figures. */
export function LinkCard({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`${CARD} block hover:border-brand-300 hover:shadow-card ${className}`}
    >
      {children}
    </Link>
  );
}

/** What the figures in a card are. */
export function CardLabel({ children }: { children: React.ReactNode }) {
  return <span className="block text-sm font-medium text-slate-600">{children}</span>;
}

/** The main figure of a card. One below zero means that bills are missing or wrong. */
export function BigCount({ count }: { count: number }) {
  return (
    <span
      className={`block text-4xl font-semibold tabular-nums wrap-anywhere ${
        count < 0 ? "text-rose-700" : ""
      }`}
    >
      {count}
    </span>
  );
}

/** How many of each gas, leaving out those there are none of. */
export function GasChips({ gases }: { gases: GasHeld[] }) {
  const some = gases.filter(({ quantity }) => quantity !== 0);
  if (some.length === 0) {
    return null;
  }
  return (
    <span className="mt-3 flex flex-wrap gap-2">
      {some.map(({ gas, quantity }) => (
        <span
          key={gas.id}
          className={`rounded-md border px-2 py-1 text-xs wrap-anywhere ${
            quantity < 0
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          {gas.name} <span className="font-semibold tabular-nums">{quantity}</span>
        </span>
      ))}
    </span>
  );
}
