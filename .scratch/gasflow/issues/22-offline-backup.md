# 22: Offline backup

**What to build:** staff download one file that answers who holds what when there is no internet. Covers user story 79.

**Blocked by:** 07: Refiller bills; 08: Receive empties.

**Status:** ready-for-agent

- [x] A signed-in staff member can download a single HTML file from the menu
- [x] The file contains every party's current holdings, the shop's stock and the last 60 days of bills
- [x] It has inline styles and no external dependencies, and opens with no internet
- [x] It shows a note stating when it was generated
- [x] Party names and notes cannot inject markup or scripts into the file
- [x] Signed-out requests are refused
- [x] API tests check the contents, including the 60-day boundary

## Comments

**27 November 2026: built in commit `fdf03f9`, waiting on a check by hand.** Not pushed.

Still to do, signed in with real accounts. No migration is new.

- Sign in, open the menu under your name (on a phone, the menu button) and choose **Offline backup**. Do it as staff and as admin.
- Turn the internet off and open the file in the browser, on the computers and phones people will use.
- Compare **Shop stock** with **Stock** for today, and a few parties with their pages.
- Check a few bills from the last 60 days against paper.
- Leave the app open for a while, then download again.
- Download with the real records and see how large the file is and how long it takes.
- Sign out and open `/backup`; no file should come.

How it works:

- `GET /api/backup` answers with one HTML file, named such as `gasflow-backup-2026-11-27.html`. Any signed-in staff member may have it. The web app passes it on at `/backup`.
- At the top is a yellow note saying when it was generated, in India time, with links to **Shop stock**, **Customers**, **Refillers** and **Bills**.
- **Shop stock** has each gas by fill state, with a total. A retired gas is there only while the shop has some of it.
- **Customers** and **Refillers** list every one by name, inactive ones marked, with what each holds by gas, a total and the party's notes. Suppliers are not listed.
- **Bills** has every bill dated from 59 days before today, the newest first: date, number, type, from and to, each line, slip number, vehicle and notes. Cancelled bills are struck through, with why.
- Counts below zero are red.
- The file has its own styles and no scripts, and tells the browser to fetch and run nothing. Everything typed into the records is shown as text. Search it with the browser's own find.
- Its parts are read in one database transaction, so a bill saved during a download is in every part or in none.
- **Offline backup** is in the menu under the staff member's name, and in the phone menu above **Sign out**, with a line saying what the file holds.

Checked:

- `pnpm check`, with 832 tests, and `pnpm build` passed on the code committed.
- Before the review, the menu and the download were driven with the Playwright MCP in headless Chrome, at 1280 and 360 wide, in a throwaway copy of the app with sign-in replaced by the identity stand-in, on a new database with made-up figures. Nothing was run against Clerk or the development database.
- The downloaded file was opened from disk with the network off. It asked for nothing else. The bills table was cut off on a phone, so each bill now reads from top to bottom there. After that change the page had no sideways scrolling at 320, 390, 640, 641, 768 and 1280 wide; at 320 the shop table scrolled by itself, by 5 pixels.
- Printing was only measured for width, not read.
- Out of the code review came: a retired gas held by others no longer shows as a row of zeros under **Shop stock**, and some names and tidying. The file was not opened in a browser again after those changes.
- Safari, Firefox and a real phone have not been tried.

For the project owner to decide:

- Shop stock and holdings count every posted bill, bills dated after today among them, as parties' pages do. **Stock**, the Balance register and the dashboard stop at today, so they can differ while such a bill exists.
- The 60 days are today and the 59 before it. Bills dated after today are listed too.
- Cancelled bills are listed.
- The file has parties' notes, but no mobile numbers, contacts or addresses.
- A bill does not say who entered it, what a return was matched to, or what is still pending on it.
- Anyone who has a downloaded file can read it, with no sign-in.

