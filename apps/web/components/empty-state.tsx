/** In place of a list with nothing in it. */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
      {children}
    </p>
  );
}
