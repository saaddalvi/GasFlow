/**
 * A piece of an HTML file. Only the `html` tag below makes one, so whatever a
 * piece holds that was not written in the code has been made harmless.
 */
class Html {
  constructor(readonly text: string) {}
}

export type { Html };

/** What may be put into a piece: other pieces as they are, anything else as text. */
type Content = Html | Content[] | string | number | null | false | undefined;

/**
 * Writes a piece of HTML, as in html`<td>${name}</td>`. Text put into it shows
 * as it was typed and is never read as markup, whether between tags or between
 * the quotes of an attribute. Nothing is shown for null, undefined or false.
 */
export function html(written: TemplateStringsArray, ...contents: Content[]): Html {
  return new Html(String.raw({ raw: written }, ...contents.map(asMarkup)));
}

function asMarkup(content: Content): string {
  if (content instanceof Html) {
    return content.text;
  }
  if (Array.isArray(content)) {
    return content.map(asMarkup).join("");
  }
  if (content === null || content === undefined || content === false) {
    return "";
  }
  return String(content).replace(/[&<>"']/g, (character) => ENTITIES[character]!);
}

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
