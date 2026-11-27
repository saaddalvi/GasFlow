import { PARTY_TYPES, type PartySummary } from "@gasflow/shared";

/** The figures for every party, whatever the list below is narrowed to. */
export function Summary({
  summary: { active, withCustomers, atRefillers, belowZero },
}: {
  summary: PartySummary;
}) {
  const breakdown = PARTY_TYPES.map((type) => {
    const count = active[type];
    return `${count} ${count === 1 ? type : `${type}s`}`;
  }).join(" · ");

  return (
    <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Figure
        label="Active parties"
        count={PARTY_TYPES.reduce((sum, type) => sum + active[type], 0)}
        note={breakdown}
      />
      <Figure label="With customers" count={withCustomers} note={cylinders(withCustomers)} />
      <Figure label="At refillers" count={atRefillers} note={cylinders(atRefillers)} />
      <Figure
        label="Below zero"
        count={belowZero}
        note={`${belowZero === 1 ? "party" : "parties"} with a count below zero`}
        warning={belowZero > 0}
      />
    </dl>
  );
}

const cylinders = (count: number) => (Math.abs(count) === 1 ? "cylinder" : "cylinders");

function Figure({
  label,
  count,
  note,
  warning,
}: {
  label: string;
  count: number;
  /** What the figure counts. */
  note: string;
  /** For a count that means something is wrong. */
  warning?: boolean;
}) {
  // A holding below zero is wrong too.
  const wrong = warning || count < 0;
  return (
    <div
      className={`min-w-0 rounded-xl border p-4 sm:p-5 ${
        wrong ? "border-rose-200 bg-rose-50/40" : "border-slate-200 bg-white"
      }`}
    >
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd>
        <span
          className={`block text-4xl font-semibold tabular-nums wrap-anywhere ${
            wrong ? "text-rose-700" : ""
          }`}
        >
          {count}
        </span>
        <span className="text-sm text-slate-500">{note}</span>
      </dd>
    </div>
  );
}
