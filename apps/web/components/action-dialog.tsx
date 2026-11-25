"use client";

import { useId, useRef, useState } from "react";
import { ActionForm, type ActionFormProps } from "./action-form";
import { buttonStyles } from "./button-styles";

/** A button that opens a box asking for, or confirming, one change. */
export function ActionDialog({
  trigger,
  title,
  description,
  ...form
}: Omit<ActionFormProps, "onCancel" | "onDone"> & {
  /** The words on the button that opens the box. */
  trigger: string;
  title: string;
  description: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Each opening starts a fresh form, without what was typed or refused last time.
  const [opening, setOpening] = useState(0);
  const close = () => dialog.current?.close();

  function open() {
    setOpening((count) => count + 1);
    dialog.current?.showModal();
  }

  return (
    <>
      <button type="button" onClick={open} className={buttonStyles.secondary}>
        {trigger}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-5 text-left text-slate-900 shadow-lg backdrop:bg-slate-900/40"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">{description}</p>
        <ActionForm key={opening} {...form} onCancel={close} onDone={close} />
      </dialog>
    </>
  );
}
