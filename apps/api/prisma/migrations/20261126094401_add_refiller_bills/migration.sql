-- CreateIndex
CREATE UNIQUE INDEX "bills_one_slip_number_per_refiller" ON "bills"("from_party_id", "number") WHERE (type = 'return_from_refiller' AND status = 'posted');

-- Prisma cannot describe these, so they are written by hand.
-- Sends to a refiller are numbered from the agency's paper too, so they say which
-- paper, and share each paper kind's numbers with dispatches.
ALTER TABLE "bills" DROP CONSTRAINT "bills_paper_kind_on_paper_bills";
ALTER TABLE "bills" ADD CONSTRAINT "bills_paper_kind_on_paper_bills" CHECK (("type" IN ('dispatch', 'send_to_refiller')) = ("paper_kind" IS NOT NULL));
-- A slip number is unique for its refiller, so the index above needs one named:
-- it would let any number of bills with none share a number.
ALTER TABLE "bills" ADD CONSTRAINT "bills_refiller_on_refiller_returns" CHECK ("type" <> 'return_from_refiller' OR "from_party_id" IS NOT NULL);
