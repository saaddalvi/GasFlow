"use client";

import { useId, useImperativeHandle, useRef, useState } from "react";
import { ActionForm, type ActionFormProps } from "./action-form";
import { buttonStyles } from "./button-styles";

/** For opening a box from elsewhere. */
export interface ActionDialogHandle {
  open: () => void;
}

/** A box asking for, or confirming, one change, and usually a button that opens it. */
export function ActionDialog({
  ref,
  trigger,
  title,
  description,
  onOpen,
  ...form
}: Omit<ActionFormProps, "onCancel" | "onDone"> & {
  ref?: React.Ref<ActionDialogHandle>;
  /**
   * The words on the button that opens the box. Left out, there is no button, as
   * for a box that must sit outside the form its button is in.
   */
  trigger?: string;
  title: string;
  description: string;
  /** Called each time the box is opened. */
  onOpen?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Each opening starts a fresh form, without what was typed or refused last time.
  const [opening, setOpening] = useState(0);
  const close = () => dialog.current?.close();

  function open() {
    onOpen?.();
    setOpening((count) => count + 1);
    dialog.current?.showModal();
  }

  useImperativeHandle(ref, () => ({ open }));

  return (
    <>
      {trigger && (
        <button type="button" onClick={open} className={buttonStyles.secondary}>
          {trigger}
        </button>
      )}
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
