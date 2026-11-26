-- CreateTable
CREATE TABLE "bill_revisions" (
    "bill_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "replaced_by_id" UUID NOT NULL,
    "replaced_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bill_revisions_pkey" PRIMARY KEY ("bill_id","version")
);

-- AddForeignKey
ALTER TABLE "bill_revisions" ADD CONSTRAINT "bill_revisions_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_revisions" ADD CONSTRAINT "bill_revisions_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
