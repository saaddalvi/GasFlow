import type { Bill } from "@gasflow/shared";
import { Tag } from "./tag";

/** Whether a bill counts. */
export function BillStatusTag({ status }: { status: Bill["status"] }) {
  return (
    <Tag colour={status === "posted" ? "green" : "grey"}>
      {status === "posted" ? "Posted" : "Cancelled"}
    </Tag>
  );
}
