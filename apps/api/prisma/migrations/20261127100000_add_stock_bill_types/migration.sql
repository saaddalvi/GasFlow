-- AlterEnum
-- Added on their own, because a new value cannot be used in the transaction that
-- adds it.
ALTER TYPE "bill_type" ADD VALUE 'add_cylinders';
ALTER TYPE "bill_type" ADD VALUE 'write_off';
