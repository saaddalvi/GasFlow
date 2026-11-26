-- CreateEnum
CREATE TYPE "bill_type" AS ENUM ('opening_stock');

-- CreateEnum
CREATE TYPE "bill_status" AS ENUM ('posted', 'cancelled');

-- CreateEnum
CREATE TYPE "fill_state" AS ENUM ('filled', 'empty', 'defective');

-- CreateTable
CREATE TABLE "bills" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "bill_type" NOT NULL,
    "number" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "bill_status" NOT NULL DEFAULT 'posted',
    "from_party_id" UUID,
    "to_party_id" UUID,
    "entered_by_id" UUID NOT NULL,
    "entered_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bill_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "gas_id" UUID NOT NULL,
    "fill_state" "fill_state" NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "bill_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_number_counters" (
    "prefix" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "last" INTEGER NOT NULL,

    CONSTRAINT "bill_number_counters_pkey" PRIMARY KEY ("prefix","date")
);

-- CreateIndex
CREATE INDEX "bills_date_idx" ON "bills"("date");

-- CreateIndex
CREATE INDEX "bills_from_party_id_idx" ON "bills"("from_party_id");

-- CreateIndex
CREATE INDEX "bills_to_party_id_idx" ON "bills"("to_party_id");

-- CreateIndex
CREATE UNIQUE INDEX "bills_one_opening_stock_per_party" ON "bills"("to_party_id") WHERE (type = 'opening_stock' AND status = 'posted');

-- CreateIndex
CREATE UNIQUE INDEX "bill_lines_bill_id_line_no_key" ON "bill_lines"("bill_id", "line_no");

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_from_party_id_fkey" FOREIGN KEY ("from_party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_to_party_id_fkey" FOREIGN KEY ("to_party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_entered_by_id_fkey" FOREIGN KEY ("entered_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_gas_id_fkey" FOREIGN KEY ("gas_id") REFERENCES "gases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma cannot describe these, so they are written by hand.
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_quantity_positive" CHECK ("quantity" > 0);
-- Cylinders come from somewhere or go somewhere.
ALTER TABLE "bills" ADD CONSTRAINT "bills_has_a_party" CHECK ("from_party_id" IS NOT NULL OR "to_party_id" IS NOT NULL);
