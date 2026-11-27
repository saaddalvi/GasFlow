import {
  billName,
  BILL_TYPE_NAMES,
  CARD_FIGURES,
  CARD_FIGURE_NAMES,
  PARTY_TYPE_NAMES,
  pendingBillName,
  WRITE_OFF_REASON_NAMES,
  type StockCard,
  type StockCardBill,
  type StockCardFigures,
  type StockCardLine,
} from "@gasflow/shared";

/** A stock card as a file for a spreadsheet, with what the card on screen shows. */
export function stockCardCsv(shopName: string, card: StockCard): { name: string; text: string } {
  const { party, from, to } = card;
  const headings = CARD_FIGURE_NAMES[party.type];
  const rows: Cell[][] = [
    ["Shop", shopName],
    ["Stock card", party.name],
    ["Type", PARTY_TYPE_NAMES[party.type]],
    ["From", from],
    ["To", to],
    [],
    [
      "Row",
      "Date",
      "Bill type",
      "Bill",
      "Gas",
      headings.sent,
      headings.returned,
      headings.writtenOff,
      headings.holding,
      "Against",
    ],
    ...card.opening.map(({ gas, quantity }) => [
      ...["Opening", from, "", "", gas.name],
      ...["", "", "", quantity, ""],
    ]),
    ...card.months.flatMap(({ month, bills, gases }) => [
      ...bills.flatMap(billRows),
      ...gases.map((figures) => figuresRow("Month", month, figures)),
    ]),
    ...card.closing.map((figures) => figuresRow("Closing", to, figures)),
  ];
  return {
    name: fileName(card),
    // The mark at the start tells a spreadsheet that the text is UTF-8.
    text: `\uFEFF${rows.map((row) => `${row.map(cell).join(",")}\r\n`).join("")}`,
  };
}

type Cell = string | number;

/** One row for each gas on a bill, with its quantity under the figure it adds to. */
function billRows(bill: StockCardBill): Cell[][] {
  const { type, paperKind, number, date, writeOffReason, gases } = bill;
  const described = writeOffReason
    ? `${BILL_TYPE_NAMES[type]} (${WRITE_OFF_REASON_NAMES[writeOffReason]})`
    : BILL_TYPE_NAMES[type];
  const under = (figure: (typeof CARD_FIGURES)[typeof type], quantity: number) =>
    CARD_FIGURES[type] === figure ? quantity : "";
  return gases.map((line) => [
    "Bill",
    date,
    described,
    billName({ paperKind, number }),
    line.gas.name,
    under("sent", line.quantity),
    under("returned", line.quantity),
    under("writtenOff", line.quantity),
    "",
    allocationNotes(line).join("; "),
  ]);
}

/**
 * What a line was against, one phrase for each bill, such as
 * "2 against Bill 1234", and one for what is unmatched.
 */
function allocationNotes({ against, unmatched }: StockCardLine): string[] {
  const notes = against.map(({ bill, quantity }) => `${quantity} against ${pendingBillName(bill)}`);
  return unmatched > 0 ? [...notes, `${unmatched} unmatched`] : notes;
}

function figuresRow(
  row: string,
  date: string,
  { gas, sent, returned, writtenOff, holding }: StockCardFigures,
): Cell[] {
  return [row, date, "", "", gas.name, sent, returned, writtenOff, holding, ""];
}

/** A value as it is written in the file. */
function cell(value: Cell): string {
  if (typeof value === "number") {
    return String(value);
  }
  // A spreadsheet takes text beginning like this for a formula, which an
  // apostrophe stops.
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Such as "stock-card-city-hospital-2026-11-01-to-2026-11-26.csv". */
function fileName({ party, from, to }: StockCard): string {
  const name = party.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${["stock-card", name, from, "to", to].filter(Boolean).join("-")}.csv`;
}
