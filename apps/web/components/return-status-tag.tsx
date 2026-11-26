import type { ReturnStatus } from "@gasflow/shared";
import { Tag } from "./tag";

const STATUSES = {
  open: { name: "Open", colour: "brand" },
  partly_returned: { name: "Partly returned", colour: "amber" },
  closed: { name: "Closed", colour: "grey" },
} as const;

/** How much of a bill has been returned or written off. */
export function ReturnStatusTag({ status }: { status: ReturnStatus }) {
  const { name, colour } = STATUSES[status];
  return <Tag colour={colour}>{name}</Tag>;
}
