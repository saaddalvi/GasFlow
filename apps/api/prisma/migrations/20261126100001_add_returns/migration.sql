-- AlterTable
ALTER TABLE "bills" ADD COLUMN     "slip_number" TEXT;

-- CreateTable
CREATE TABLE "allocations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clearing_line_id" UUID NOT NULL,
    "cleared_line_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "allocations_cleared_line_id_idx" ON "allocations"("cleared_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "allocations_clearing_line_id_cleared_line_id_key" ON "allocations"("clearing_line_id", "cleared_line_id");

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_clearing_line_id_fkey" FOREIGN KEY ("clearing_line_id") REFERENCES "bill_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_cleared_line_id_fkey" FOREIGN KEY ("cleared_line_id") REFERENCES "bill_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma cannot describe these, so they are written by hand.
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "bills" ADD CONSTRAINT "bills_slip_number_on_customer_returns" CHECK ("type" = 'return_from_customer' OR "slip_number" IS NULL);
