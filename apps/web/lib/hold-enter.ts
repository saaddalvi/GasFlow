/**
 * For around a form that is saved only by its button: Enter in a box, which is
 * easily pressed halfway through, does nothing.
 */
export function holdEnter(event: React.KeyboardEvent) {
  if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
    event.preventDefault();
  }
}
