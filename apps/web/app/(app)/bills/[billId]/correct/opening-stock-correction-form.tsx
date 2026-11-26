"use client";

import { checkInput, openingStockCorrectionSchema, type Bill, type Gas } from "@gasflow/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { asFormLines, asNewLines, LineList } from "@/components/line-fields";
import type { Outcome } from "@/lib/api";
import { holdEnter } from "@/lib/hold-enter";
import { billPath } from "@/lib/routes";
import { correctBill } from "../../actions";

/** The lines of a party's opening stock, which are all of it that can be corrected. */
export function OpeningStockCorrectionForm({ bill, gases }: { bill: Bill; gases: Gas[] }) {
  const router = useRouter();
  const [lines, setLines] = useState(() => asFormLines(bill.lines));

  async function submit(): Promise<Outcome> {
    const { data, problem } = checkInput(openingStockCorrectionSchema, {
      type: bill.type,
      lines: asNewLines(lines, "filled"),
    });
    return data ? correctBill(bill.id, data) : { error: problem };
  }

  return (
    <section
      onKeyDown={holdEnter}
      className="max-w-3xl rounded-xl border border-slate-200 bg-white p-5"
    >
      <ActionForm
        action={submit}
        submitLabel="Save correction"
        onCancel={() => router.push(billPath(bill.id))}
      >
        <LineList lines={lines} onChange={setLines} gases={gases} defaultFillState="filled" />
      </ActionForm>
    </section>
  );
}
