import Link from "next/link";
import {
  BALANCE_REGISTER_PATH,
  BILLS_PATH,
  DAY_LEDGER_PATH,
  NEW_BILL_PATH,
  OPENING_STOCK_PATH,
  PARTIES_PATH,
  RECEIVE_EMPTIES_PATH,
  STOCK_REPORT_PATH,
} from "@/lib/routes";
import { Section } from "./parts";

const ACTIONS: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: RECEIVE_EMPTIES_PATH, label: "Receive empties" },
  { href: BILLS_PATH, label: "Bills" },
  { href: STOCK_REPORT_PATH, label: "Stock" },
  { href: PARTIES_PATH, label: "Parties" },
  { href: DAY_LEDGER_PATH, label: "Day ledger" },
  { href: BALANCE_REGISTER_PATH, label: "Balance register" },
  { href: OPENING_STOCK_PATH, label: "Opening stock", adminOnly: true },
];

const TILE = "flex min-h-16 items-center rounded-xl border p-4 text-sm font-medium";

/** The screens used most, a tap away. */
export function QuickActions({ isAdmin }: { isAdmin: boolean }) {
  return (
    <Section label="Quick actions">
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <li className="grid">
          <Link
            href={NEW_BILL_PATH}
            className={`${TILE} border-brand-500 bg-brand-500 text-base font-semibold text-white hover:bg-brand-600`}
          >
            + New bill
          </Link>
        </li>
        {ACTIONS.filter((action) => isAdmin || !action.adminOnly).map(({ href, label }) => (
          <li key={href} className="grid">
            <Link
              href={href}
              className={`${TILE} border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:shadow-card`}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
