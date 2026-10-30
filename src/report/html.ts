const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }

/** Every piece of text from disk or from a model goes through this before it reaches the page. */
export function escapeHtml(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]!)
}
