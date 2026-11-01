import { readFileSync } from "fs";
import path from "path";

/**
 * Reads one `## Heading` section from a Markdown file in web/prompts/.
 * Read on every call so teammates' edits apply without a restart.
 */
export function promptSection(file: string, heading: string): string {
  const text = readFileSync(path.join(process.cwd(), "prompts", file), "utf8");
  const sections = text.split(/^## /m).slice(1);
  const hit = sections.find((s) => s.split("\n")[0].trim().toLowerCase() === heading.toLowerCase());
  if (!hit) throw new Error(`prompts/${file} has no "## ${heading}" section`);
  return hit.slice(hit.indexOf("\n") + 1).trim();
}
