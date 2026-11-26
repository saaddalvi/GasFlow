/**
 * What differs from the record a form was opened with. Saving only that leaves
 * alone whatever a colleague changed in the meantime.
 */
export function changedOnly<Changes extends object>(
  changes: Changes,
  opened: { [Key in keyof Changes]?: unknown },
): Partial<Changes> {
  const differing = Object.entries(changes).filter(
    ([key, value]) => value !== opened[key as keyof Changes],
  );
  return Object.fromEntries(differing) as Partial<Changes>;
}
