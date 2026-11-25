# GasFlow

Tracks where a gas agency's cylinders are: at the shop, with customers, or at refillers.

## Language

**Cylinder**:
A physical gas container owned or handled by the agency. Cylinders are only ever counted in quantities; no cylinder has an identity of its own.
_Avoid_: Cylinder serial, asset, unit

**Gas**:
What a cylinder is for, such as Medical oxygen or Nitrogen, and the only attribute cylinders are counted by. Size is not distinguished.
_Avoid_: Gas type, product, cylinder type

**Fill state**:
Whether cylinders are filled, empty or defective. It is recorded on every bill but only counted for cylinders at the shop.
_Avoid_: Status, condition

**Holding**:
The number of cylinders of a gas that a customer or refiller currently has, regardless of fill state.
_Avoid_: Balance, outstanding

### Bills

**Bill**:
A dated record of cylinders moving between parties, or joining or leaving the business.
_Avoid_: Invoice, challan, transaction

**Bill number**:
The number identifying a bill. On the agency's own paper (dispatches and sends to a refiller) no two bills of the same paper kind ever share one, in any year; on returns from a refiller it is the refiller's slip number, unique for that refiller; all other bills are numbered automatically. Cancelling a bill frees its number.
_Avoid_: Serial, bill serial

**Slip number**:
The optional number of a paper return slip, noted on a return. It need not be unique.

**Paper kind**:
Which kind of paper record a bill was written on, such as a bill or a cash memo.
_Avoid_: Bill type

**Dispatch bill**:
A bill for cylinders sent from the shop to a customer. It cannot be cancelled or changed in a way that breaks a return or write-off allocated to it.
_Avoid_: Sale, delivery

**Return**:
Cylinders coming back from a customer, recorded by receiving empties and matched to the dispatch bills they went out on. The cylinders may occasionally be filled or defective. A wrong return is cancelled and recorded again, never corrected.
_Avoid_: Internal transfer, collection

**Allocation**:
The part of a return or customer write-off that is matched to one gas on one dispatch bill or opening stock dated no later than it.
_Avoid_: Mapping, link

**Opening stock**:
The cylinders of each gas a party already held on the start date, entered at most once per party. A customer's opening stock takes returns and write-offs like a dispatch bill, with the same protection against breaking them.
_Avoid_: Opening balance

**Start date**:
The single date from which the business's records begin. No bill is dated earlier.
_Avoid_: Go-live date, opening date

**Pending**:
The cylinders of a gas on a dispatch bill or customer's opening stock that no return or write-off has yet cleared.
_Avoid_: Outstanding, due, open quantity

**Add cylinders**:
A bill for cylinders joining the business, optionally naming the supplier.
_Avoid_: Purchase, stock adjustment

**Write-off**:
A bill for cylinders leaving the business for good because they were scrapped or lost, from the shop, a customer or a refiller. A write-off from a customer clears pending on a dispatch bill or opening stock, and a wrong one is cancelled and entered again, never corrected.
_Avoid_: Deletion, stock adjustment

**Days out**:
The number of days pending cylinders have been with a customer, counted from the date of their dispatch bill or from the start date for opening stock.
_Avoid_: Age

**Overdue**:
Pending cylinders whose days out exceed the overdue limit, a single period set by an admin that applies to every customer.
_Avoid_: Late, forgotten

**Unmatched return**:
Returned cylinders in excess of everything the customer had pending for that gas as of the return date, awaiting allocation to a dispatch bill. They count as back at the shop.
_Avoid_: Unallocated return, extra, other

### People

**Staff**:
A person who works for the agency and signs in to record bills and view stock. Staff are not parties.
_Avoid_: User, operator

**Admin**:
A staff member who may also change opening stock, add or write off cylinders, correct or cancel anyone's bills, set the overdue limit, and manage gases and staff.
_Avoid_: Owner, manager

### Parties

**Shop**:
The agency's single own location, where all cylinders not out with someone else are kept.
_Avoid_: Warehouse, godown, store, location

**Customer**:
Someone who receives cylinders from the shop and is expected to return them.
_Avoid_: Client, buyer

**Refiller**:
A plant that receives empty cylinders from the shop and sends them back filled.
_Avoid_: Plant, filling station, vendor

**Supplier**:
A business the agency gets new cylinders from.
_Avoid_: Vendor, dealer
