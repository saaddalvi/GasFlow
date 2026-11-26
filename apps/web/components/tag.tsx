const COLOURS = {
  brand: "bg-brand-50 text-brand-700",
  grey: "bg-slate-100 text-slate-600",
  green: "bg-emerald-100 text-emerald-800",
};

/** A small coloured pill that says something about what it sits beside. */
export function Tag({
  colour = "grey",
  children,
}: {
  colour?: keyof typeof COLOURS;
  children: React.ReactNode;
}) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLOURS[colour]}`}>
      {children}
    </span>
  );
}
