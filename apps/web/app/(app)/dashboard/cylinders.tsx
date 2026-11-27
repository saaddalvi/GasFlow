import {
  balanceRegisterQuerySchema,
  countAtShop,
  FILL_STATES,
  type Dashboard,
  type FillState,
  type RegisterParty,
  type StockReportRow,
} from "@gasflow/shared";
import { balanceRegisterSearch } from "@/lib/balance-register-search";
import { BALANCE_REGISTER_PATH, STOCK_REPORT_PATH } from "@/lib/routes";
import { BigCount, CardLabel, counted, GasChips, LinkCard, Section } from "./parts";

const FILL_STATE_STYLES: Record<FillState, { label: string; colours: string }> = {
  filled: { label: "Filled", colours: "bg-emerald-50 text-emerald-800" },
  empty: { label: "Empty", colours: "bg-slate-100 text-slate-700" },
  defective: { label: "Defective", colours: "bg-amber-50 text-amber-800" },
};

/** The register narrowed to the holdings of one type of party. */
function registerHref(type: RegisterParty["type"]): string {
  const query = { ...balanceRegisterQuerySchema.parse({}), type };
  return `${BALANCE_REGISTER_PATH}?${balanceRegisterSearch(query)}`;
}

/** Where every cylinder is as of today. */
export function Cylinders({ dashboard: { cylinders } }: { dashboard: Dashboard }) {
  const { total, shop, customers, refillers, gases } = cylinders;
  /** One figure of the stock report's, gas by gas. */
  const byGas = (count: (row: StockReportRow) => number) =>
    gases.map((row) => ({ gas: row.gas, quantity: count(row) }));

  return (
    <Section label="Your cylinders">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <LinkCard href={STOCK_REPORT_PATH}>
          <CardLabel>Total cylinders</CardLabel>
          <BigCount count={total} />
          <span className="block text-sm text-slate-500">Shop, customers and refillers</span>
          <GasChips gases={byGas((row) => row.total)} />
        </LinkCard>
        <LinkCard href={STOCK_REPORT_PATH}>
          <CardLabel>Shop stock</CardLabel>
          <BigCount count={shop.total} />
          <span className="block text-sm text-slate-500">At the shop</span>
          <span className="mt-3 grid grid-cols-3 gap-1 text-center">
            {FILL_STATES.map((fillState) => {
              const { label, colours } = FILL_STATE_STYLES[fillState];
              const count = shop[fillState];
              return (
                <span
                  key={fillState}
                  className={`min-w-0 rounded-md px-1 py-1 text-xs ${
                    count < 0 ? "bg-rose-100 text-rose-700" : colours
                  }`}
                >
                  <span className="block text-base font-semibold tabular-nums wrap-anywhere">
                    {count}
                  </span>
                  {label}
                </span>
              );
            })}
          </span>
          <GasChips gases={byGas((row) => countAtShop(row.shop))} />
        </LinkCard>
        <LinkCard href={registerHref("customer")}>
          <CardLabel>With customers</CardLabel>
          <BigCount count={customers.held} />
          <span className="block text-sm text-slate-500">
            {counted(customers.parties, "customer")}
          </span>
          <GasChips gases={byGas((row) => row.customers)} />
        </LinkCard>
        <LinkCard href={registerHref("refiller")}>
          <CardLabel>At refillers</CardLabel>
          <BigCount count={refillers.held} />
          <span className="block text-sm text-slate-500">
            {counted(refillers.parties, "refiller")}
          </span>
          <GasChips gases={byGas((row) => row.refillers)} />
        </LinkCard>
      </div>
    </Section>
  );
}
