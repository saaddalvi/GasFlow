import { Field } from "@/components/fields";
import { formatDate, formatDateInFull } from "@/lib/dates";

/** A bill's date, spelled out underneath to check against the paper. */
export function BillDateField({
  startDate,
  today,
  value,
  onChange,
}: {
  startDate: string;
  /** Given for a date that is usually today's, which is then pointed out. */
  today?: string;
  value: string;
  onChange: (date: string) => void;
}) {
  return (
    <div>
      <Field
        label="Date"
        type="date"
        required
        min={startDate}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        hint={`Records begin on ${formatDate(startDate)}.`}
      />
      <p aria-live="polite" className="mt-1 text-sm font-medium empty:hidden">
        {value && `${value === today ? "Today, " : ""}${formatDateInFull(value)}`}
      </p>
    </div>
  );
}
