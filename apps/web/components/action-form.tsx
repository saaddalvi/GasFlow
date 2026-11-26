"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
import type { Outcome } from "@/lib/api";
import { billPath } from "@/lib/routes";
import { buttonStyles } from "./button-styles";

export interface ActionFormProps {
  /** Makes the change, and says why if it was not made. */
  action: (form: FormData) => Promise<Outcome>;
  submitLabel: string;
  /** For a change that takes something away. */
  danger?: boolean;
  onCancel?: () => void;
  /** The words on the button that gives up, where "Cancel" would be unclear. */
  cancelLabel?: string;
  onDone?: () => void;
  children?: React.ReactNode;
}

/**
 * A form for one change. It keeps what was typed and shows the reason when the
 * change is refused. When the change is made it goes where the outcome says, or
 * else starts again with fresh fields.
 */
export function ActionForm({
  action,
  submitLabel,
  danger,
  onCancel,
  cancelLabel = "Cancel",
  onDone,
  children,
}: ActionFormProps) {
  // Why the last try was refused, if it was.
  const [refusal, setRefusal] = useState<Outcome>();
  const [changesMade, setChangesMade] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Sent by hand, because a form's own `action` empties the fields even after a refusal.
  function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setRefusal(undefined);
    startTransition(async () => {
      const outcome = await action(form).catch((): Outcome => ({
        error: "The web app could not be reached. Check your connection and try again.",
      }));
      setRefusal(outcome.error ? outcome : undefined);
      const { goTo } = outcome;
      if (goTo) {
        // The button stays disabled until the next page is up.
        startTransition(() => router.push(goTo));
      } else if (!outcome.error) {
        // Empties the fields, and hides any password that was being shown.
        setChangesMade((count) => count + 1);
        onDone?.();
      }
    });
  }

  return (
    // "post" keeps passwords out of the address if this is sent before the page is ready.
    <form
      method="post"
      onSubmit={submit}
      // The browser stops a form with an invalid field before it is sent, and points
      // at the field. What was said about an earlier try goes.
      onInvalidCapture={() => setRefusal(undefined)}
      className="space-y-4"
    >
      <Fragment key={changesMade}>{children}</Fragment>
      {refusal && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          <p>{refusal.error}</p>
          {refusal.blockingBills && (
            <ul className="mt-1 flex flex-wrap gap-x-3">
              {refusal.blockingBills.map(({ id, number }) => (
                <li key={id}>
                  <Link href={billPath(id)} className="inline-block py-1 font-medium underline">
                    {number}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className={buttonStyles.secondary}>
            {cancelLabel}
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className={danger ? buttonStyles.danger : buttonStyles.primary}
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
