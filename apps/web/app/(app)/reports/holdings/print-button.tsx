"use client";

import { buttonStyles } from "@/components/button-styles";

/** Prints the page, through the browser's own print window. */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonStyles.secondary}>
      Print
    </button>
  );
}
