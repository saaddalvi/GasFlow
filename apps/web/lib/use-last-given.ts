"use client";

import { useState } from "react";

/**
 * What a page last gave a form. A page loads again after a change; should that
 * fail and give nothing, the form keeps what it had, so that what is on screen is
 * not lost.
 */
export function useLastGiven<Value>(value: Value | null): Value | null {
  const [held, setHeld] = useState(value);
  if (value && value !== held) setHeld(value);
  return value ?? held;
}
