-- Compares text without regard to capitals.
CREATE EXTENSION IF NOT EXISTS citext;

-- AlterTable
ALTER TABLE "parties" ALTER COLUMN "name" SET DATA TYPE CITEXT;
