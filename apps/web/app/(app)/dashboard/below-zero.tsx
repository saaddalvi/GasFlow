import { balanceRegisterQuerySchema, type Dashboard } from "@gasflow/shared";
import Link from "next/link";
import { balanceRegisterSearch } from "@/lib/balance-register-search";
import { BALANCE_REGISTER_PATH, STOCK_REPORT_PATH } from "@/lib/routes";
import { Card, CardLabel } from "./parts";

/** The register narrowed to the parties with a count below zero. */
const partiesBelowZeroHref = `${BALANCE_REGISTER_PATH}?${balanceRegisterSearch({
  ...balanceRegisterQuerySchema.parse({}),
  show: "below_zero",
})}`;

/** Counts that cannot be right, at the shop and with parties. */
export function BelowZero({ shop, parties }: Dashboard["belowZero"]) {
  const total = shop + parties;
  const link = "block rounded-md py-1 text-sm font-medium hover:underline";

  return (
    <Card className={total > 0 ? "border-rose-200 bg-rose-50/40" : ""}>
      <CardLabel>Counts below zero</CardLabel>
      <span
        className={`block text-4xl font-semibold tabular-nums ${total > 0 ? "text-rose-700" : ""}`}
      >
        {total}
      </span>
      {/* One party may have several, so there can be more of these than parties. */}
      {total > 0 && (
        <p className="text-sm text-slate-500">Counted gas by gas. Bills are missing or wrong.</p>
      )}
      <div className="mt-2">
        <Link
          href={STOCK_REPORT_PATH}
          className={`${link} ${shop > 0 ? "text-rose-700" : "text-slate-500"}`}
        >
          {shop} at the shop
        </Link>
        <Link
          href={partiesBelowZeroHref}
          className={`${link} ${parties > 0 ? "text-rose-700" : "text-slate-500"}`}
        >
          {parties} with parties
        </Link>
      </div>
    </Card>
  );
}
