"use client";

import { Fragment, useState, useTransition } from "react";
import type { Outcome } from "@/lib/api";
import { buttonStyles } from "./button-styles";

export interface ActionFormProps {
  /** Makes the change, and says why if it was not made. */
  action: (form: FormData) => Promise<Outcome>;
  submitLabel: string;
  /** For a change that takes something away. */
  danger?: boolean;
  onCancel?: () => void;
  onDone?: () => void;
  children?: React.ReactNode;
}

/**
 * A form for one change. It keeps what was typed and shows the reason when the
 * change is refused, and starts again with fresh fields when the change is made.
 */
export function ActionForm({
  action,
  submitLabel,
  danger,
  onCancel,
  onDone,
  children,
}: ActionFormProps) {
  const [error, setError] = useState<string>();
  const [changesMade, setChangesMade] = useState(0);
  const [pending, startTransition] = useTransition();

  // Sent by hand, because a form's own `action` empties the fields even after a refusal.
  function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(undefined);
    startTransition(async () => {
      const outcome = await action(form).catch(() => ({
        error: "The web app could not be reached. Check your connection and try again.",
      }));
      setError(outcome.error);
      if (!outcome.error) {
        // Empties the fields, and hides any password that was being shown.
        setChangesMade((count) => count + 1);
        onDone?.();
      }
    });
  }

  return (
    // "post" keeps passwords out of the address if this is sent before the page is ready.
    <form method="post" onSubmit={submit} className="space-y-4">
      <Fragment key={changesMade}>{children}</Fragment>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className={buttonStyles.secondary}>
            Cancel
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
