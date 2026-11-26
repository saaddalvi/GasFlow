-- CreateEnum
CREATE TYPE "paper_kind" AS ENUM ('bill', 'cash_memo');

-- DropIndex
DROP INDEX "bills_date_idx";

-- AlterTable
ALTER TABLE "bills" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paper_kind" "paper_kind",
ADD COLUMN     "vehicle_id" UUID,
ALTER COLUMN "number" SET DATA TYPE CITEXT;

-- CreateIndex
CREATE INDEX "bills_date_entered_at_idx" ON "bills"("date", "entered_at");

-- CreateIndex
CREATE UNIQUE INDEX "bills_one_number_per_paper_kind" ON "bills"("paper_kind", "number") WHERE (status = 'posted');

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Prisma cannot describe this, so it is written by hand.
-- The bills numbered from the agency's paper say which paper, so that the unique
-- index above covers every such number.
ALTER TABLE "bills" ADD CONSTRAINT "bills_paper_kind_on_paper_bills" CHECK (("type" = 'dispatch') = ("paper_kind" IS NOT NULL));
