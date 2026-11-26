"use client";

import { returnCustomerListSchema, type ReturnCustomerList } from "@gasflow/shared";
import { SearchPicker, type Choice } from "@/components/search-picker";
import { RECEIVE_EMPTIES_PATH } from "@/lib/routes";

type Customer = ReturnCustomerList["customers"][number];

/**
 * A box to search the active customers by name and choose one, each shown with
 * what they have pending. Receive empties and a customer's write-off use it.
 */
export function CustomerPicker({
  chosen,
  onChoose,
  focused = false,
}: {
  chosen: Choice | null;
  onChoose: (customer: Choice | null) => void;
  /** Whether the box takes the focus, so that typing can start at once. */
  focused?: boolean;
}) {
  return (
    <SearchPicker
      label="Customer"
      noun="customer"
      focused={focused}
      chosen={chosen}
      onChoose={(customer: Customer | null) =>
        onChoose(customer && { id: customer.id, name: customer.name })
      }
      address={(search) =>
        `${RECEIVE_EMPTIES_PATH}/customers?${new URLSearchParams({ search }).toString()}`
      }
      schema={returnCustomerListSchema}
      read={({ customers, total }) => ({ options: customers, total })}
      detail={({ pending, mobile }) => (
        <>
          <span className="tabular-nums">{pending} pending</span>
          {mobile && ` · ${mobile}`}
        </>
      )}
    />
  );
}
