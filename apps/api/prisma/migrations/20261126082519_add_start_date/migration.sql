-- CreateTable
CREATE TABLE "setup" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "start_date" DATE NOT NULL,

    CONSTRAINT "setup_pkey" PRIMARY KEY ("id")
);

-- Setup has one row at most. Prisma cannot describe this, so it is written by hand.
ALTER TABLE "setup" ADD CONSTRAINT "setup_one_row" CHECK ("id" = 1);
