/**
 * A short code made from a name: the first letters of its words, or the start of
 * a name that is one word. "Sharma Gas Agency" gives "SGA" and "Apollo" "APO".
 */
export function abbreviate(name: string): string {
  // Letters carry their marks, as in Devanagari. An apostrophe does not end a word.
  const words = name.replace(/['’]/g, "").match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
  const [first = name, ...others] = words;
  const code =
    others.length === 0
      ? firstCharacters(first, 3)
      : firstCharacters(words.map((word) => firstCharacters(word, 1)).join(""), 5);
  return code.toUpperCase();
}

/** Counted by code point, so that no character is cut in half. */
function firstCharacters(text: string, count: number): string {
  return Array.from(text).slice(0, count).join("");
}
