-- CreateEnum
CREATE TYPE "party_type" AS ENUM ('shop', 'customer', 'refiller', 'supplier');

-- CreateTable
CREATE TABLE "parties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "party_type" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "gases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parties_one_shop" ON "parties"("type") WHERE (type = 'shop');

-- CreateIndex
CREATE UNIQUE INDEX "gases_name_key" ON "gases"("name");
