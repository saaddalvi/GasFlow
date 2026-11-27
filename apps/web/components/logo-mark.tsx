/** The cylinder tile that stands in until the agency supplies a logo. */
export function LogoMark() {
  return (
    // Printed with its background, which browsers otherwise leave off paper.
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-white">
        <path d="M10 2h4v3h-4zM12 6a5 5 0 0 1 5 5v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a5 5 0 0 1 5-5Z" />
      </svg>
    </span>
  );
}
