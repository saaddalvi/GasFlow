-- CreateEnum
CREATE TYPE "cancel_reason" AS ENUM ('data_entry_error', 'duplicate_entry', 'customer_rejected', 'wrong_cylinder_loaded', 'bill_voided', 'other');

-- AlterTable
ALTER TABLE "bills" ADD COLUMN     "cancel_notes" TEXT,
ADD COLUMN     "cancel_reason" "cancel_reason",
ADD COLUMN     "cancelled_at" TIMESTAMPTZ(3),
ADD COLUMN     "cancelled_by_id" UUID;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma cannot describe this, so it is written by hand. A cancelled bill says
-- who cancelled it, when and why, and a posted bill says none of that.
ALTER TABLE "bills" ADD CONSTRAINT "bills_cancellation_recorded" CHECK (
  CASE WHEN "status" = 'cancelled'
    THEN "cancel_reason" IS NOT NULL AND "cancelled_by_id" IS NOT NULL AND "cancelled_at" IS NOT NULL
    ELSE "cancel_reason" IS NULL AND "cancel_notes" IS NULL AND "cancelled_by_id" IS NULL AND "cancelled_at" IS NULL
  END
);
