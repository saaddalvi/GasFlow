import type { ListedBill, ReturnCounts } from "@gasflow/shared";
import Link from "next/link";
import { describeBillType, quantitiesByGas } from "@/lib/bill-names";
import { formatDate } from "@/lib/dates";
import { billPath } from "@/lib/routes";
import { BillStatusTag } from "./bill-status-tag";

/** A page of bills, each with its number linking to it. */
export function BillTable({ bills }: { bills: ListedBill[] }) {
  return (
    // Relative, so that the hidden words in the table scroll with it.
    <div className="relative overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th scope="col" className="px-5 py-3 font-semibold">
              Number
            </th>
            <th scope="col" className="hidden px-3 py-3 font-semibold md:table-cell">
              Date
            </th>
            <th scope="col" className="hidden px-3 py-3 font-semibold md:table-cell">
              Type
            </th>
            <th scope="col" className="px-3 py-3 font-semibold">
              From and to
            </th>
            <th scope="col" className="hidden px-3 py-3 font-semibold lg:table-cell">
              Lines
            </th>
            <th scope="col" className="hidden px-3 py-3 font-semibold sm:table-cell">
              Returned
            </th>
            <th scope="col" className="hidden px-5 py-3 font-semibold sm:table-cell">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {bills.map((bill) => (
            <Row key={bill.id} bill={bill} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One bill. On a narrow screen, what has no column of its own sits under another. */
function Row({ bill }: { bill: ListedBill }) {
  const { id, number, date, from, to, lines, status, returns } = bill;
  const quantities = quantitiesByGas(lines);

  return (
    <tr className="align-top">
      <td className="px-5 py-3">
        <Link
          href={billPath(id)}
          className="font-medium text-brand-700 tabular-nums wrap-anywhere hover:underline"
        >
          {number}
        </Link>
        <span className="block text-slate-500 md:hidden">{formatDate(date)}</span>
        <span className="block text-slate-500 md:hidden">{describeBillType(bill)}</span>
        <span className="mt-1 block sm:hidden">
          <BillStatusTag status={status} />
        </span>
      </td>
      <td className="hidden whitespace-nowrap px-3 py-3 md:table-cell">{formatDate(date)}</td>
      <td className="hidden px-3 py-3 md:table-cell">{describeBillType(bill)}</td>
      <td className="px-3 py-3 wrap-anywhere">
        {from && <span className="block text-slate-500">{from.name} →</span>}
        {/* Only a write-off has nobody receiving. */}
        {to ? to.name : "Written off"}
        <span className="mt-1 block text-slate-500 lg:hidden">{quantities}</span>
        {returns && (
          <span className="mt-1 block sm:hidden">
            Returned <Returned counts={returns} />
          </span>
        )}
      </td>
      <td className="hidden px-3 py-3 lg:table-cell">{quantities}</td>
      <td className="hidden px-3 py-3 sm:table-cell">{returns && <Returned counts={returns} />}</td>
      <td className="hidden px-5 py-3 sm:table-cell">
        <BillStatusTag status={status} />
      </td>
    </tr>
  );
}

/**
 * How many of a dispatch's cylinders have come back, such as "3 / 5". Any written
 * off are said too, as they are not pending either.
 */
function Returned({ counts: { sent, returned, writtenOff } }: { counts: ReturnCounts }) {
  return (
    <>
      <span className="whitespace-nowrap tabular-nums">
        {returned} / {sent}
      </span>
      {writtenOff > 0 && (
        <span className="block whitespace-nowrap text-slate-500 tabular-nums">
          {writtenOff} written off
        </span>
      )}
    </>
  );
}
