/** In place of something the API did not give. */
export function LoadError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700"
    >
      {children}
    </p>
  );
}
