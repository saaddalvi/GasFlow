/** A file for someone to save. */
export interface DownloadedFile {
  name: string;
  text: string;
}

/**
 * A file's name from these parts, in small letters with nothing but hyphens
 * between words, such as "stock-card-city-hospital.csv". It is safe to quote in
 * a header, whatever the parts hold.
 */
export function fileName(parts: string[], extension: string): string {
  const name = parts
    .map((part) =>
      part
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    )
    .filter(Boolean)
    .join("-");
  return `${name}.${extension}`;
}
