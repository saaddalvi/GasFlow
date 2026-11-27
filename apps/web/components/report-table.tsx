/** Stays in view while the figures are scrolled sideways on a narrow screen. */
export const ROW_HEADING_CELL = "sticky left-0 bg-white px-5 py-3 text-left";

/** The card around a report's table of counts, which scrolls sideways if it must. */
export function ReportTable({
  labelledBy,
  children,
}: {
  /** The id of the heading that names the table. */
  labelledBy?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table aria-labelledby={labelledBy} className="w-full text-right text-sm tabular-nums">
        {children}
      </table>
    </div>
  );
}

/** One figure. A negative count means that bills are missing or wrong, so it stands out. */
export function CountCell({
  count,
  startsGroup,
  bold,
}: {
  count: number;
  startsGroup?: boolean;
  bold?: boolean;
}) {
  const colours = count < 0 ? "bg-rose-100 text-rose-700" : count === 0 ? "text-slate-400" : "";
  return (
    <td
      className={`px-3 py-3 print:px-1 print:py-1 ${startsGroup ? "border-l border-slate-100" : ""} ${
        bold ? "font-semibold" : ""
      } ${colours}`}
    >
      {count}
    </td>
  );
}
