# 20: Stock card

**What to build:** staff produce a statement for one party over a date range, to settle questions and share it. Covers user stories 76 and 77.

**Blocked by:** 14: Customer write-offs.

**Status:** ready-for-agent

- [x] The stock card shows, per gas, dispatched, received back and holding, with an opening row and one row per month that expands into linked bills
- [x] The range defaults to the current financial year from 1 April, with a "Full history" option
- [x] Opening stock forms the starting position and is not shown as dispatched
- [x] Each return line shows the bill it was allocated to, such as "against 1234"; unmatched quantities are marked
- [x] Write-offs are shown distinctly from returns
- [x] The card can be downloaded as CSV with the same figures
- [x] The printed card shows the shop name and logo, with no address; until a logo is supplied, the app's cylinder mark is used
- [x] The closing holding matches the Balance register for the end date

## Comments

**27 November 2026: built in commit `53158df`, waiting on a check by hand.** Pushed since, as recorded at the end.

Still to do, signed in with real accounts. No migration is new.

- Open **Reports**, then **Stock card**, and choose a customer with a history. Check a few months against paper, open them, and follow the links to bills.
- Compare **Closing** with the Balance register for the same date.
- Try **Full history**, then dates of your own, then **This financial year**.
- Download the CSV and open it in the spreadsheet program the agency uses.
- Print the card from the browser people will use, on the paper they will use.
- Open a card from a customer's page and a refiller's page, and on a real phone.

How it works:

- `GET /api/reports/holdings?partyId=&from=&to=&full=` answers `{ party, startDate, from, to, gases, opening, months, closing }`. Each month has its figures by gas and its bills, and each gas on a bill has `quantity`, `against` and `unmatched`. `GET /api/reports/holdings.csv` takes the same query and gives the file.
- Left out, `to` is today and `from` is 1 April of `to`'s financial year. `full=true` begins at the start date whatever `from` says. No card begins before the start date, and there is nothing on one that ends before it.
- Cards are for customers and refillers. A supplier is refused, and the shop is "no such party".
- The opening row is what was held as the range began. Opening stock is part of it, even on the start date, and is never counted as dispatched.
- Each gas has **Dispatched** (**Sent** for a refiller), **Received back**, **Written off** and **Holding**. On screen **Written off** appears only when the card has some; the CSV always has it.
- A return or customer write-off says what it was against, such as "2 against Bill 1234", "against Cash memo 88" or "against Opening stock". What a return has unmatched is marked. A refiller's returns are matched to nothing.
- The screen is at `/reports/holdings`, the blueprint's address. It is in the **Reports** menu, and customers' and refillers' pages have a **Stock card** button.
- The party list takes `holders=true`, which narrows it to customers and refillers, for the card's picker.
- The whole card comes in one answer, unlike other long lists, so that it can be printed and downloaded whole.

Checked:

- `pnpm check`, with 789 tests, and `pnpm build` passed on the code committed.
- The screens were driven with the Playwright MCP in headless Chrome, in a throwaway copy of the app with sign-in replaced by the identity stand-in, on a new database with made-up figures. Nothing was run against Clerk or the development database.
- Tried before the review: choosing a party, opening months, the CSV download, Full history, typed dates, a refiller, a party with nothing on its card, a date before the start date, dates the wrong way round, an unknown party, the button on a party's page, the Reports menu, and nine gases, which are split into three tables. Print was checked as PDFs made by the headless browser.
- No sideways scrolling of the page at 320, 390, 768, 1024 and 1280 wide. The table scrolls by itself at 1024 and narrower. The first column was then narrowed for phones, and only 320 and 1280 were measured again.
- The code review found no wrong figures. Out of it came: a row for every month, a **From** box left blank unless asked for (changing only **To** to an earlier year was refused), no **Download CSV** or **Print** before the records begin, the write-off reason in the CSV, and some names. After those changes the quiet months, the date boxes, the earlier year, the missing buttons and the CSV download were tried again at 1280 wide. Print was not.
- Safari, Firefox, a real phone, a real printer and a spreadsheet program have not been tried.

For the project owner to decide:

- Every month in the range has a row, with bills or not. A month that has not come has one only if a bill is dated in it or later within the range.
- Printing shows every month's bills, whether opened on screen or not, on landscape pages.
- With more than three gases the card is split into several tables.
- The range ends today unless a later date is chosen, **Full history** included, so bills dated after today are left off. A party's page counts them in what it holds.
- The card's picker offers inactive parties too.

**27 November 2026: pushed.**

- Pushed up to `2b554b3`, and [CI passed on it](https://github.com/saaddalvi/GasFlow/actions/runs/45998581178).
- The checks under "Still to do" are not recorded as done.

**27 November 2026: completed** in commit `53158df`.

- The project owner asked for the ticket to be marked complete. No results of the checks under "Still to do", signed in with real accounts or on a real phone, are recorded here.
- The code committed in `53158df` has not changed since.
- The decisions listed for the project owner are not recorded as settled.

