/** In place of rows that are still being loaded, or could not be. */
export function LoadState({
  what,
  failed,
  onRetry,
}: {
  /** What was asked for, such as "closed bills". */
  what: string;
  failed?: boolean;
  onRetry: () => void;
}) {
  return failed ? (
    <p role="alert" className="text-sm text-rose-700">
      The {what} could not be loaded.{" "}
      <button type="button" onClick={onRetry} className="underline">
        Try again
      </button>
    </p>
  ) : (
    <p role="status" className="text-sm text-slate-500">
      Loading…
    </p>
  );
}
