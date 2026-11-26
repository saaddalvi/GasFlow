# 10: Unmatched returns

**What to build:** cylinders returned in excess of everything pending are saved as unmatched, listed, and later matched to a bill. Covers user stories 49 to 51, 54 and 55.

**Blocked by:** 08: Receive empties.

**Status:** ready-for-agent

- [ ] Receive empties lets staff add a gas and quantity as unmatched, alone or alongside allocated rows
- [ ] Saving is refused if cylinders are left unmatched while eligible pending cylinders of that gas remain after this return's allocations
- [ ] A customer with nothing pending can be chosen and their cylinders saved as unmatched
- [ ] Unmatched cylinders count as back at the shop and reduce the customer's holding
- [ ] A list shows all unmatched returns with customer, gas, quantity, date and return number
- [ ] Any staff member can use "Match to bill" to allocate all or part of an unmatched quantity to a bill or opening stock of the same customer and gas, dated on or before the return
- [ ] Matching never exceeds the pending or unmatched quantity, including when two saves happen at once
- [ ] A customer's holding of each gas equals pending minus unmatched after returns and matching
- [ ] Unmatched cylinders may remain alongside pending ones after a missing dispatch bill is entered, until matched

## Comments

**26 November 2026: built in commits `94911b1` and `7c86ccc`.** Not pushed, so CI has not run on it.

How it works:

- Unmatched cylinders are the part of a return line that no allocation covers (`apps/api/src/services/unmatched.ts`). No table changed, so there is no migration.
- `POST /api/returns` takes `unmatched: [{ gasId, quantity, fillState }]` beside `allocations`. Either may be empty, but not both.
- `GET /api/returns/unmatched?page` lists one row for each return and gas, oldest return first, 50 to a page.
- `POST /api/returns/:returnId/matches` takes `{ billId, gasId, quantity }` and answers `{ unmatched }`, what is left of that gas. It locks the customer, as saving a return does.
- Receive empties has an **Unmatched cylinders** section. After **Fill oldest first**, a button puts the leftover cylinders there. That row then follows the fill when the date or total changes; rows added by hand are left alone.
- The list is at **Unmatched returns**, reached from Receive empties and from the confirmation after saving. It is not in the navigation bar.

Checked:

- Lint, type checks and 405 tests pass. `pnpm check` itself still stops on the untracked `.mcp.json`.
- The three tests of saves at the same moment fail when the customer lock is taken out of matching.
- The screens were driven with the Playwright MCP in headless Chrome, in a throwaway copy of the app with sign-in replaced by the identity stand-in and its own database. Nothing was run against Clerk. Receive empties, the list and the Match to bill box had no sideways scrolling at 320, 390, 768, 1024 and 1280 wide. Safari, Firefox and a real phone have not been tried.
- This found that **Fill oldest first** showed twice after a refused save. It was already so before this ticket, and is fixed in `94911b1`.

For the project owner to decide:

- A retired gas cannot be saved as unmatched, as for other new entries, although it can still be returned against a bill. An admin has to bring the gas back first.
- A match cannot be undone. Until ticket 11, a wrong one stays.
- Nothing records who matched, or when. The bill shows the return with whoever entered the return.
- Unmatched cylinders of an inactive customer can still be matched.

For later tickets:

- Ticket 11: cancelling a return removes it from the unmatched list and from matching, since both read posted returns only. A match against a cancelled return is refused as having nothing unmatched; it may deserve its own message. A bill that cylinders were matched to has allocations like any other.
- Ticket 14: a customer write-off is never unmatched. The unmatched list reads returns only.
- Ticket 17: the customer's page will need the unmatched list narrowed to one customer.
- Ticket 20: matching adds to the return's allocations, so a stock card can show a return against a bill entered after it.
