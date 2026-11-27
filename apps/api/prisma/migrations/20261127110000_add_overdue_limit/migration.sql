-- CreateTable
CREATE TABLE "overdue_limit" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "days" INTEGER NOT NULL,

    CONSTRAINT "overdue_limit_pkey" PRIMARY KEY ("id")
);

-- The limit has one row at most, and is a number of days. Prisma cannot describe
-- either, so they are written by hand.
ALTER TABLE "overdue_limit" ADD CONSTRAINT "overdue_limit_one_row" CHECK ("id" = 1);
ALTER TABLE "overdue_limit" ADD CONSTRAINT "overdue_limit_some_days" CHECK ("days" > 0);
