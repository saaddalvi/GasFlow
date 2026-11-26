-- AlterEnum
-- Added on their own, because a new value cannot be used in the transaction that
-- adds it.
ALTER TYPE "bill_type" ADD VALUE 'send_to_refiller';
ALTER TYPE "bill_type" ADD VALUE 'return_from_refiller';
