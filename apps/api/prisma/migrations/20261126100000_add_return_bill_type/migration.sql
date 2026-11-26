-- AlterEnum
-- Added on its own, because a new value cannot be used in the transaction that
-- adds it.
ALTER TYPE "bill_type" ADD VALUE 'return_from_customer';
