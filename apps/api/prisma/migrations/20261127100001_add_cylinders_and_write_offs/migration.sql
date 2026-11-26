-- CreateEnum
CREATE TYPE "write_off_reason" AS ENUM ('scrapped', 'lost');

-- AlterTable
ALTER TABLE "bills" ADD COLUMN     "write_off_reason" "write_off_reason";

-- Prisma cannot describe these, so they are written by hand.
ALTER TABLE "bills" ADD CONSTRAINT "bills_reason_on_write_offs" CHECK (("type" = 'write_off') = ("write_off_reason" IS NOT NULL));
-- Cylinders that are added join the business, and those written off leave it.
ALTER TABLE "bills" ADD CONSTRAINT "bills_add_cylinders_receiver" CHECK ("type" <> 'add_cylinders' OR "to_party_id" IS NOT NULL);
ALTER TABLE "bills" ADD CONSTRAINT "bills_write_off_sides" CHECK ("type" <> 'write_off' OR ("from_party_id" IS NOT NULL AND "to_party_id" IS NULL));
