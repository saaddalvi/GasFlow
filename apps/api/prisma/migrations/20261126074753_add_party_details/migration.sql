-- AlterTable
ALTER TABLE "parties" ADD COLUMN     "abbreviation" TEXT,
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "address" TEXT,
ADD COLUMN     "contact_person" TEXT,
ADD COLUMN     "mobile" TEXT,
ADD COLUMN     "notes" TEXT;
