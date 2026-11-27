/** A count of cylinders held. One below zero means that bills are missing or wrong. */
export function CylinderCount({ count }: { count: number }) {
  return (
    <span className={`tabular-nums ${count < 0 ? "rounded bg-rose-100 px-1 text-rose-700" : ""}`}>
      {count}
    </span>
  );
}
