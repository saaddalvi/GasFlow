import {
  BILL_STATUS_NAMES,
  BILL_TYPE_NAMES,
  billName,
  CANCEL_REASON_NAMES,
  countAtShop,
  FILL_STATE_NAMES,
  formatDate,
  formatMoment,
  indianDate,
  REGISTER_PARTY_TYPES,
  vehicleName,
  WRITE_OFF_REASON_NAMES,
  type StockReportRow,
} from "@gasflow/shared";
import type { Backup, BackupBill, BackupParty } from "./backup";
import { fileName, type DownloadedFile } from "./downloaded-file";
import { html, type Html } from "./html";

/** How the page looks, on a screen of any width and on paper. */
const STYLES = html`<style>
  body {
    max-width: 64rem;
    margin: 0 auto;
    padding: 1rem;
    background: #fff;
    color: #0f172a;
    font:
      15px/1.5 system-ui,
      sans-serif;
  }
  h1 {
    margin: 0 0 0.75rem;
    font-size: 1.5rem;
  }
  h2 {
    margin: 2rem 0 0.5rem;
    font-size: 1.125rem;
  }
  .note {
    padding: 0.75rem 1rem;
    border: 1px solid #facc15;
    border-radius: 0.5rem;
    background: #fef9c3;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  nav a {
    display: inline-block;
    margin-right: 1rem;
    padding: 0.25rem 0;
    color: #1d4ed8;
  }
  .wide {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th,
  td {
    padding: 0.4rem 0.75rem 0.4rem 0;
    border-bottom: 1px solid #e2e8f0;
    text-align: left;
    vertical-align: top;
    overflow-wrap: break-word;
  }
  thead th {
    color: #64748b;
    font-size: 0.75rem;
    text-transform: uppercase;
  }
  tr {
    break-inside: avoid;
  }
  .count,
  #shop thead th + th,
  #customers thead th:last-child,
  #refillers thead th:last-child {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .below-zero {
    color: #be123c;
    font-weight: 600;
  }
  .detail,
  .notes {
    color: #64748b;
    font-weight: 400;
  }
  .tag {
    display: inline-block;
    padding: 0 0.4rem;
    border-radius: 0.25rem;
    background: #e2e8f0;
    color: #334155;
    font-size: 0.75rem;
    font-weight: 400;
  }
  .cancelled td {
    color: #64748b;
    text-decoration: line-through;
  }
  .cancelled td:first-child,
  .cancelled td:last-child {
    text-decoration: none;
  }
  /* On a phone, the counts are set closer, and each bill reads from top to bottom. */
  @media screen and (max-width: 40rem) {
    body {
      font-size: 13px;
    }
    th,
    td {
      padding-right: 0.4rem;
    }
    #bills thead {
      display: none;
    }
    #bills tr {
      display: block;
      padding: 0.5rem 0;
      border-bottom: 1px solid #e2e8f0;
    }
    #bills th,
    #bills td {
      display: block;
      padding: 0;
      border: 0;
    }
  }
</style>`;

/**
 * The parts of the page by their ids, which the links and styles go by, in the
 * order they come.
 */
const PARTS = {
  shop: "Shop stock",
  customers: "Customers",
  refillers: "Refillers",
  bills: "Bills",
} as const;

type PartId = keyof typeof PARTS;

/** The backup as one page that needs nothing else, to be read with no internet. */
export function backupFile({
  shop,
  generatedAt,
  stock,
  parties,
  billsFrom,
  bills,
}: Backup): DownloadedFile {
  const page = html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta
          http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src 'unsafe-inline'"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${shop.name} backup, ${formatDate(indianDate(generatedAt))}</title>
        ${STYLES}
      </head>
      <body>
        <h1>${shop.name} offline backup</h1>
        <p class="note">
          Generated on ${formatMoment(generatedAt.toISOString())} (India time). It shows the records
          as they were then, and does not change. Download a new one to see anything saved since.
        </p>
        <nav>
          ${Object.entries(PARTS).map(([id, heading]) => html`<a href="#${id}">${heading}</a>`)}
        </nav>
        ${shopStock(stock)}
        ${REGISTER_PARTY_TYPES.map((type) =>
          holders(
            type,
            parties.filter((party) => party.type === type),
          ),
        )}
        ${billList(billsFrom, bills)}
      </body>
    </html>`;
  return {
    name: fileName([shop.name, "backup", indianDate(generatedAt)], "html"),
    text: page.text,
  };
}

function shopStock(rows: StockReportRow[]): Html {
  return part(
    "shop",
    table(
      ["Gas", "Filled", "Empty", "Defective", "Total"],
      rows.map(
        ({ gas, shop }) =>
          html`<tr>
            <th scope="row">${gas.name}</th>
            ${[shop.filled, shop.empty, shop.defective, countAtShop(shop)].map(count)}
          </tr>`,
      ),
    ),
  );
}

/** The customers, or the refillers, with what each holds. */
function holders(type: BackupParty["type"], parties: BackupParty[]): Html {
  const id = `${type}s` as const;
  if (parties.length === 0) {
    return part(id, html`<p>There are no ${id}.</p>`);
  }
  return part(
    id,
    table(
      ["Name", "Cylinders held", "Total"],
      parties.map(
        ({ name, active, notes, gases, total }) =>
          html`<tr>
            <th scope="row">
              ${name} ${!active && html`<span class="tag">Inactive</span>`}
              ${notes && html`<div class="notes">${typed(notes)}</div>`}
            </th>
            <td>
              ${gases.length === 0 && "Nothing"}
              ${gases.map(
                ({ gas, quantity }) =>
                  html`<div class="${quantity < 0 && "below-zero"}">${gas.name} ${quantity}</div>`,
              )}
            </td>
            ${count(total)}
          </tr>`,
      ),
    ),
  );
}

function billList(from: string, bills: BackupBill[]): Html {
  const dated = html`<p>Bills dated ${formatDate(from)} or later, the newest first.</p>`;
  return part(
    "bills",
    bills.length === 0
      ? html`${dated}
          <p>There are no such bills.</p>`
      : html`${dated}
        ${table(["Date", "Bill", "From and to", "Cylinders", "Notes"], bills.map(billRow))}`,
  );
}

function billRow(bill: BackupBill): Html {
  const { type, date, status, from, to, writeOffReason, lines } = bill;
  const reason = writeOffReason && ` · ${WRITE_OFF_REASON_NAMES[writeOffReason]}`;
  return html`<tr class="${status}">
    <td>${formatDate(date)}</td>
    <th scope="row">
      ${billName(bill)}
      <div class="detail">${BILL_TYPE_NAMES[type]}${reason}</div>
      ${status === "cancelled" && html`<span class="tag">${BILL_STATUS_NAMES[status]}</span>`}
    </th>
    <td>${movement(from, to)}</td>
    <td>
      ${lines.map(
        ({ gas, quantity, fillState }) =>
          html`<div>${gas} ${quantity} ${FILL_STATE_NAMES[fillState].toLowerCase()}</div>`,
      )}
    </td>
    <td>${billNotes(bill)}</td>
  </tr>`;
}

/** Whom the cylinders moved between, such as "GasFlow → City Hospital". */
function movement(from: string | null, to: string | null): string {
  // Only a write-off has nobody receiving, and cylinders that join the business
  // come from nobody unless a supplier is named.
  const received = to ?? "Written off";
  return from === null ? received : `${from} → ${received}`;
}

/** What else the bill says, and why it was cancelled if it was. */
function billNotes({ slipNumber, vehicle, notes, cancelReason, cancelNotes }: BackupBill): Html[] {
  return [
    slipNumber && `Slip number: ${slipNumber}`,
    vehicle && `Vehicle: ${vehicleName(vehicle)}`,
    notes,
    cancelReason && `Cancelled: ${CANCEL_REASON_NAMES[cancelReason]}`,
    cancelNotes,
  ].flatMap((note) => (note ? [html`<div>${typed(note)}</div>`] : []));
}

/** Text kept on the lines it was typed on. */
function typed(text: string) {
  return text.split("\n").map((line, index) => [index > 0 && html`<br />`, line]);
}

function part(id: PartId, content: Html): Html {
  return html`<section id="${id}">
    <h2>${PARTS[id]}</h2>
    ${content}
  </section>`;
}

function table(headings: string[], rows: Html[]): Html {
  // A table too wide for the screen scrolls by itself.
  return html`<div class="wide">
    <table>
      <thead>
        <tr>
          ${headings.map((heading) => html`<th scope="col">${heading}</th>`)}
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>`;
}

/** A count of cylinders, in red when there are fewer than none. */
function count(quantity: number): Html {
  return html`<td class="${quantity < 0 ? "count below-zero" : "count"}">${quantity}</td>`;
}
