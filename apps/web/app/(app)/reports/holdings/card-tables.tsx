"use client";

import {
  billName,
  CARD_FIGURES,
  CARD_FIGURE_NAMES,
  pendingBillName,
  BILL_TYPE_NAMES,
  WRITE_OFF_REASON_NAMES,
  type StockCard,
  type StockCardBill,
  type StockCardFigures,
  type StockCardLine,
  type StockCardMonth,
} from "@gasflow/shared";
import Link from "next/link";
import { Fragment, useState } from "react";
import { CountCell, ReportTable } from "@/components/report-table";
import { Tag } from "@/components/tag";
import { formatDate, formatMonth } from "@/lib/dates";
import { billPath } from "@/lib/routes";

/** More gases than this share the card between several tables, to fit screen and paper. */
const GASES_PER_TABLE = 3;

type Figure = "sent" | "returned" | "writtenOff" | "holding";

interface Column {
  figure: Figure;
  name: string;
}

/**
 * A row's name, which stays in view while the figures are scrolled sideways. It is
 * kept narrow on a phone, to leave room for them.
 */
const HEADING_CELL =
  "sticky left-0 min-w-32 bg-white px-3 py-3 text-left align-top sm:min-w-56 sm:px-5 print:static print:px-2 print:py-1";

/** The card's figures, a few gases to a table, with a column for each figure of each. */
export function CardTables({ card }: { card: StockCard }) {
  // Most cards have nothing written off, and then no column for it.
  const writtenOff = card.closing.some((figures) => figures.writtenOff > 0);
  const figures: Figure[] = writtenOff
    ? ["sent", "returned", "writtenOff", "holding"]
    : ["sent", "returned", "holding"];
  const columns = figures.map((figure) => ({
    figure,
    name: CARD_FIGURE_NAMES[card.party.type][figure],
  }));
  const tables: StockCard["gases"][] = [];
  for (let at = 0; at < card.gases.length; at += GASES_PER_TABLE) {
    tables.push(card.gases.slice(at, at + GASES_PER_TABLE));
  }

  return (
    <div className="space-y-6">
      {tables.map((gases) => (
        <CardTable key={gases[0]!.id} card={card} gases={gases} columns={columns} />
      ))}
    </div>
  );
}

/** The statement of these gases: what was held to begin with, each month, and the end. */
function CardTable({
  card: { from, to, opening, months, closing },
  gases,
  columns,
}: {
  card: StockCard;
  gases: StockCard["gases"];
  columns: Column[];
}) {
  const shown = new Set(gases.map((gas) => gas.id));
  const ofShown = <Row extends { gas: { id: string } }>(rows: Row[]) =>
    rows.filter((row) => shown.has(row.gas.id));

  return (
    <ReportTable>
      <thead className="border-b border-slate-200 text-xs text-slate-500">
        <tr>
          <th scope="col" rowSpan={2} className={`${HEADING_CELL} align-bottom`}>
            Month
          </th>
          {gases.map((gas) => (
            <th
              key={gas.id}
              scope="colgroup"
              colSpan={columns.length}
              className="border-l border-slate-100 px-3 pt-3 text-left text-sm font-semibold text-slate-900 sm:text-center print:px-1 print:pt-1"
            >
              {gas.name}
            </th>
          ))}
        </tr>
        <tr>
          {gases.map((gas) =>
            columns.map(({ figure, name }, index) => (
              <th
                key={`${gas.id} ${figure}`}
                scope="col"
                className={`px-3 py-2 align-bottom font-semibold print:px-1 print:py-1 ${
                  index === 0 ? "border-l border-slate-100" : ""
                }`}
              >
                {name}
              </th>
            )),
          )}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        <tr className="print:break-inside-avoid">
          <th scope="row" className={`${HEADING_CELL} font-medium`}>
            Opening
            <span className="block font-normal text-slate-500">{formatDate(from)}</span>
          </th>
          {ofShown(opening).map(({ gas, quantity }) =>
            columns.map(({ figure }, index) =>
              figure === "holding" ? (
                <CountCell key={`${gas.id} ${figure}`} count={quantity} />
              ) : (
                <td
                  key={`${gas.id} ${figure}`}
                  className={index === 0 ? "border-l border-slate-100" : undefined}
                />
              ),
            ),
          )}
        </tr>
        {months.map((month) => (
          <Month
            key={month.month}
            month={month}
            figures={ofShown(month.gases)}
            bills={month.bills
              .map((bill) => ({ ...bill, gases: ofShown(bill.gases) }))
              .filter((bill) => bill.gases.length > 0)}
            gases={gases}
            columns={columns}
          />
        ))}
        <tr className="border-t-2 border-slate-200 print:break-inside-avoid">
          <th scope="row" className={`${HEADING_CELL} font-semibold`}>
            Closing
            <span className="block font-normal text-slate-500">{formatDate(to)}</span>
          </th>
          <Figures figures={ofShown(closing)} columns={columns} bold />
        </tr>
      </tbody>
    </ReportTable>
  );
}

/** One month, which opens to show its bills. Paper shows them whether open or not. */
function Month({
  month: { month },
  figures,
  bills,
  gases,
  columns,
}: {
  month: StockCardMonth;
  figures: StockCardFigures[];
  /** The month's bills that have any of these gases, with only those. */
  bills: StockCardBill[];
  gases: StockCard["gases"];
  columns: Column[];
}) {
  const [open, setOpen] = useState(false);
  const name = formatMonth(`${month}-01`);

  return (
    <Fragment>
      <tr className="print:break-inside-avoid">
        <th scope="row" className={`${HEADING_CELL} font-medium`}>
          {bills.length === 0 ? (
            name
          ) : (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
              className="flex items-center gap-1 text-left text-brand-700 hover:underline print:text-slate-900"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className={`size-4 shrink-0 fill-none stroke-current print:hidden ${
                  open ? "" : "-rotate-90"
                }`}
              >
                <path
                  d="m6 9 6 6 6-6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {name}
            </button>
          )}
        </th>
        <Figures figures={figures} columns={columns} bold />
      </tr>
      {bills.map((bill) => (
        <tr
          key={bill.id}
          className={`align-top print:break-inside-avoid ${open ? "" : "hidden print:table-row"}`}
        >
          <th scope="row" className={`${HEADING_CELL} pl-6 font-normal sm:pl-10 print:pl-4`}>
            <BillHeading bill={bill} />
          </th>
          {gases.map((gas) => {
            const line = bill.gases.find((candidate) => candidate.gas.id === gas.id);
            return columns.map(({ figure }, index) => (
              <td
                key={`${gas.id} ${figure}`}
                className={`px-3 py-3 print:px-1 print:py-1 ${
                  index === 0 ? "border-l border-slate-100" : ""
                }`}
              >
                {CARD_FIGURES[bill.type] === figure ? line?.quantity : null}
              </td>
            ));
          })}
        </tr>
      ))}
    </Fragment>
  );
}

/** Each gas's figures, in the columns' order. */
function Figures({
  figures,
  columns,
  bold,
}: {
  figures: StockCardFigures[];
  columns: Column[];
  bold?: boolean;
}) {
  return figures.map((ofGas) =>
    columns.map(({ figure }, index) => (
      <CountCell
        key={`${ofGas.gas.id} ${figure}`}
        count={ofGas[figure]}
        startsGroup={index === 0}
        bold={bold && figure === "holding"}
      />
    )),
  );
}

/** Which bill a row is, and what each of its lines was against. */
function BillHeading({ bill }: { bill: StockCardBill }) {
  const { id, type, date, writeOffReason, gases } = bill;
  return (
    <div className="space-y-1">
      <Link href={billPath(id)} className="text-brand-700 wrap-anywhere hover:underline">
        {billName(bill)}
      </Link>
      <span className="flex flex-wrap items-center gap-x-2 text-slate-500">
        {formatDate(date)}
        {/* Stands apart from the returns it sits among. */}
        {writeOffReason ? (
          <Tag colour="amber">
            {BILL_TYPE_NAMES[type]} · {WRITE_OFF_REASON_NAMES[writeOffReason]}
          </Tag>
        ) : (
          <span>{BILL_TYPE_NAMES[type]}</span>
        )}
      </span>
      {gases
        .filter(({ against, unmatched }) => against.length > 0 || unmatched > 0)
        .map((line) => (
          <Allocated key={line.gas.id} line={line} />
        ))}
    </div>
  );
}

/** The bills one line's cylinders were against, and how many are against none. */
function Allocated({ line: { gas, against, unmatched } }: { line: StockCardLine }) {
  return (
    <ul className="text-xs text-slate-600">
      <li className="font-medium">{gas.name}</li>
      {against.map(({ bill, quantity }) => (
        <li key={bill.id}>
          {quantity} against{" "}
          <Link href={billPath(bill.id)} className="text-brand-700 hover:underline">
            {pendingBillName(bill)}
          </Link>
        </li>
      ))}
      {unmatched > 0 && (
        <li>
          <Tag colour="amber">{unmatched} unmatched</Tag>
        </li>
      )}
    </ul>
  );
}
