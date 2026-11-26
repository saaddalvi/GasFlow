"use client";

import { useEffect, useState } from "react";

/** How long typing has to pause before anything is asked. */
const PAUSE_MS = 300;

export interface Lookup<Answer> {
  data?: Answer;
  failed?: boolean;
}

/**
 * Asks this web app something while a person types, once they pause. Gives the
 * answer to the address as it is now, or undefined while there is none yet or
 * nothing to ask. Changing `askAgain` asks the same thing again.
 */
export function useLookup<Answer>(
  address: string | null,
  /** Checks what came back, as a shared schema does. It must not change between renders. */
  schema: { parse: (body: unknown) => Answer },
  askAgain = 0,
): Lookup<Answer> | undefined {
  const [answer, setAnswer] = useState<Lookup<Answer> & { asked: string }>();
  const asked = address === null ? null : `${askAgain} ${address}`;

  useEffect(() => {
    if (address === null || asked === null) return;
    const abandoned = new AbortController();
    async function ask(address: string, asked: string) {
      try {
        const response = await fetch(address, { signal: abandoned.signal });
        if (!response.ok) {
          throw new Error(`The web app answered ${response.status} for ${address}.`);
        }
        setAnswer({ asked, data: schema.parse(await response.json()) });
      } catch (error) {
        if (!abandoned.signal.aborted) {
          console.error(error);
          setAnswer({ asked, failed: true });
        }
      }
    }
    const pause = setTimeout(() => void ask(address, asked), PAUSE_MS);
    return () => {
      clearTimeout(pause);
      abandoned.abort();
    };
  }, [address, asked, schema]);

  return answer && answer.asked === asked ? answer : undefined;
}
