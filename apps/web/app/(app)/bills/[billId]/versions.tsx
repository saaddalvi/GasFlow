import { PAPER_KIND_NAMES, type Bill, type BillVersion } from "@gasflow/shared";
import { formatDate, formatMoment } from "@/lib/dates";
import { DetailList, Lines, movementDetails } from "./bill-parts";

/**
 * Who made a corrected bill read as it has at one time or another, the newest
 * first. Each earlier version opens to show what it said.
 */
export function Versions({
  type,
  earlier,
  lastCorrection: { correctedBy, correctedAt },
}: {
  /** The bill's type, which no correction changes. */
  type: Bill["type"];
  /** The oldest first. */
  earlier: BillVersion[];
  lastCorrection: NonNullable<Bill["lastCorrection"]>;
}) {
  return (
    <section aria-labelledby="versions-heading" className="max-w-2xl space-y-3">
      <h2 id="versions-heading" className="text-lg font-semibold">
        Versions
      </h2>
      <ol reversed className="space-y-2">
        <li className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm">
          <p className="font-medium">Version {earlier.length + 1}, as shown above</p>
          <p className="text-slate-500 wrap-anywhere">
            Corrected by {correctedBy.displayName} · {formatMoment(correctedAt)}
          </p>
        </li>
        {earlier
          .map((version, index) => (
            <li key={index}>
              <Version type={type} version={version} number={index + 1} />
            </li>
          ))
          .reverse()}
      </ol>
    </section>
  );
}

/** One earlier version, shut until asked for. */
function Version({
  type,
  version: { savedBy, savedAt, ...content },
  number,
}: {
  type: Bill["type"];
  version: BillVersion;
  /** The version's place among them, counted from 1, the bill as first entered. */
  number: number;
}) {
  const { paperKind, date, lines } = content;

  return (
    <details className="rounded-xl border border-slate-200 bg-white text-sm">
      <summary className="cursor-pointer rounded-xl px-5 py-3 hover:bg-slate-50">
        <span className="font-medium">Version {number}</span>
        <span className="block text-slate-500 wrap-anywhere">
          {number === 1 ? "Entered" : "Corrected"} by {savedBy.displayName} ·{" "}
          {formatMoment(savedAt)}
        </span>
      </summary>
      {/* Rounded below, so that its background does not square off the box's corners. */}
      <div className="space-y-3 rounded-b-xl border-t border-slate-100 bg-slate-50 p-3">
        <DetailList
          details={[
            ["Number", content.number],
            ["Date", formatDate(date)],
            ["Paper kind", paperKind && PAPER_KIND_NAMES[paperKind]],
            ...movementDetails({ type, ...content }),
          ]}
        />
        <Lines lines={lines} />
      </div>
    </details>
  );
}
