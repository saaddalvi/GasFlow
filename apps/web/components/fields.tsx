"use client";

import { useId, useState } from "react";

type FieldProps = Omit<React.ComponentProps<"input">, "id" | "className"> & {
  label: string;
  /** Advice shown under the field. */
  hint?: string;
};

/** A labelled input. Required ones are marked with a star. */
export function Field({ label, hint, ...input }: FieldProps) {
  return <Labelled label={label} hint={hint} input={input} />;
}

/**
 * An input for choosing a password, whose contents can be shown to check them at
 * a shared counter.
 */
export function NewPasswordField({ label, ...input }: Omit<FieldProps, "hint">) {
  const [shown, setShown] = useState(false);

  return (
    <Labelled
      label={label}
      hint="At least 8 characters, and not one found in a leak."
      input={{ ...input, type: shown ? "text" : "password", autoComplete: "new-password" }}
    >
      <button
        type="button"
        onClick={() => setShown(!shown)}
        className="shrink-0 rounded-lg px-3 text-sm text-brand-700 hover:bg-brand-50"
      >
        {shown ? "Hide" : "Show"}
        <span className="sr-only"> password</span>
      </button>
    </Labelled>
  );
}

function Labelled({
  label,
  hint,
  input,
  children,
}: {
  label: string;
  hint?: string;
  input: React.ComponentProps<"input">;
  children?: React.ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {input.required && (
          <span aria-hidden="true" className="text-rose-600">
            {" "}
            *
          </span>
        )}
      </label>
      <div className="mt-1 flex gap-1">
        <input
          {...input}
          id={id}
          aria-describedby={hintId}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base placeholder:text-slate-400 sm:text-sm"
        />
        {children}
      </div>
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}
