import type { CandidateRole } from "./types";

const ROLE_LINE = /^(.+?)\s+(?:at|@|—|-|,|\|)\s+(.+?)(?:\s*[(|,]\s*(.+))?$/i;
const ROLE_WORDS = /engineer|manager|developer|analyst|designer|lead|intern|director|specialist|scientist|associate/i;

/** Simple rule-based role parser. Used by fake-mode extraction and the setup page's company picker. */
export function parseRoles(resume: string, max = 4): CandidateRole[] {
  const lines = resume
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const roles: CandidateRole[] = [];
  for (let i = 1; i < lines.length && roles.length < max; i++) {
    const m = lines[i].match(ROLE_LINE);
    if (m && ROLE_WORDS.test(m[1])) {
      const bullets = lines
        .slice(i + 1, i + 5)
        .filter((l) => /^[-•*▪]/.test(l))
        .map((l) => l.replace(/^[-•*▪]\s*/, ""));
      roles.push({ title: m[1], company: m[2].replace(/[()]/g, "").trim(), achievements: bullets });
    }
  }
  return roles;
}

/** Unique employer names from the résumé, most recent first. */
export function guessEmployers(resume: string): string[] {
  return [...new Set(parseRoles(resume, 8).map((r) => r.company).filter(Boolean))];
}

/** The extracted employer that matches the user's pick, or null if they picked something not on the résumé. */
export function matchEmployer(pick: string, companies: string[]): string | null {
  const a = pick.trim().toLowerCase();
  if (!a) return null;
  return (
    companies.find((c) => {
      const b = c.trim().toLowerCase();
      return b && (a === b || a.includes(b) || b.includes(a));
    }) ?? null
  );
}
