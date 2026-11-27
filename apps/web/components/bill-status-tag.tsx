import { BILL_STATUS_NAMES, type Bill } from "@gasflow/shared";
import { Tag } from "./tag";

/** Whether a bill counts. */
export function BillStatusTag({ status }: { status: Bill["status"] }) {
  return <Tag colour={status === "posted" ? "green" : "grey"}>{BILL_STATUS_NAMES[status]}</Tag>;
}
