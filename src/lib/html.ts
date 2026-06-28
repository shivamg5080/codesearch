// Minimal HTML -> readable plain text, good enough to feed a problem statement
// to the tutor. Keeps block structure as newlines and list items as "- ".

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|pre)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&minus;/g, "-")
    .replace(/&le;/g, "≤")
    .replace(/&ge;/g, "≥")
    .replace(/&times;/g, "×")
    .replace(/&ldots;|&hellip;/g, "…")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
}

/** Extract the inner HTML of the first <div class="cls">…</div>, depth-matched. */
export function extractDiv(html: string, cls: string): string | null {
  const open = html.search(new RegExp(`<div[^>]*class="[^"]*\\b${cls}\\b[^"]*"`));
  if (open < 0) return null;
  // Walk from the start of that div, matching nested <div>/</div>.
  const from = html.indexOf(">", open) + 1;
  let depth = 1;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = from;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    depth += m[0] === "</div>" ? -1 : 1;
    if (depth === 0) return html.slice(from, m.index);
  }
  return null;
}
