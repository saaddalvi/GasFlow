"use client";

import { useId, useState } from "react";

type Control<Element extends "input" | "select" | "textarea"> = Omit<
  React.ComponentProps<Element>,
  "id" | "className" | "aria-describedby"
> & {
  label: string;
  /** Advice shown under the field. */
  hint?: string;
};

const controlStyles =
  "min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base placeholder:text-slate-400 sm:text-sm";

/** A labelled input. Required ones are marked with a star. */
export function Field({ label, hint, ...input }: Control<"input">) {
  return (
    <Labelled label={label} hint={hint} required={input.required}>
      {(ids) => <input {...input} {...ids} className={controlStyles} />}
    </Labelled>
  );
}

/** A labelled box for text of several lines. */
export function TextAreaField({ label, hint, ...textarea }: Control<"textarea">) {
  return (
    <Labelled label={label} hint={hint} required={textarea.required}>
      {(ids) => <textarea rows={3} {...textarea} {...ids} className={controlStyles} />}
    </Labelled>
  );
}

/** A labelled list to choose one option from. */
export function SelectField({ label, hint, ...select }: Control<"select">) {
  return (
    <Labelled label={label} hint={hint} required={select.required}>
      {(ids) => <select {...select} {...ids} className={controlStyles} />}
    </Labelled>
  );
}

/** A yes or no. */
export function CheckboxField({
  label,
  hint,
  ...input
}: Omit<Control<"input">, "type" | "required">) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label className="flex items-center gap-2 py-1 text-sm font-medium text-slate-700">
        <input
          {...input}
          type="checkbox"
          aria-describedby={hintId}
          className="size-4 accent-brand-500"
        />
        {label}
      </label>
      <Hint id={hintId}>{hint}</Hint>
    </div>
  );
}

/**
 * An input for choosing a password, whose contents can be shown to check them at
 * a shared counter.
 */
export function NewPasswordField({ label, ...input }: Omit<Control<"input">, "hint">) {
  const [shown, setShown] = useState(false);

  return (
    <Labelled label={label} hint="At least 8 characters." required={input.required}>
      {(ids) => (
        <>
          <input
            {...input}
            {...ids}
            type={shown ? "text" : "password"}
            autoComplete="new-password"
            className={controlStyles}
          />
          <button
            type="button"
            onClick={() => setShown(!shown)}
            className="shrink-0 rounded-lg px-3 text-sm text-brand-700 hover:bg-brand-50"
          >
            {shown ? "Hide" : "Show"}
            <span className="sr-only"> password</span>
          </button>
        </>
      )}
    </Labelled>
  );
}

function Labelled({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  /** The control, given what ties it to its label and hint. */
  children: (ids: { id: string; "aria-describedby"?: string }) => React.ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span aria-hidden="true" className="text-rose-600">
            {" "}
            *
          </span>
        )}
      </label>
      <div className="mt-1 flex gap-1">{children({ id, "aria-describedby": hintId })}</div>
      <Hint id={hintId}>{hint}</Hint>
    </div>
  );
}

function Hint({ id, children }: { id?: string; children?: string }) {
  return (
    children && (
      <p id={id} className="mt-1 text-xs text-slate-500">
        {children}
      </p>
    )
  );
}
