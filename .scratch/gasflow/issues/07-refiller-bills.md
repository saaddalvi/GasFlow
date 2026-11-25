# 07: Refiller bills

**What to build:** staff send cylinders to a refiller and record them coming back. Covers user stories 27 and 28.

**Blocked by:** 06: Dispatch bills.

**Status:** ready-for-agent

- [ ] The new bill form offers Send to refiller and Return from refiller, with a single Refiller picker whose label follows the type
- [ ] A send to refiller defaults its lines to empty, and a return from refiller to filled; both can be changed
- [ ] A send to refiller takes a paper kind and number, unique forever within that paper kind across dispatches and sends to a refiller together
- [ ] A return from refiller takes the refiller's slip number, which must be unique for that refiller only
- [ ] The customer return type is not offered in this form, and the API refuses it here
- [ ] The Stock report moves cylinders between the shop's fill states and the refiller's count
- [ ] A refiller returning more than was sent is accepted and the negative count is flagged
- [ ] API tests cover both number rules and the stock effect
