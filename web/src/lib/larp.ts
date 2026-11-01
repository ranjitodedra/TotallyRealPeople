import { z } from "zod";
import { generateJson, gemini } from "./gemini";
import { promptSection } from "./prompt-file";
import { newId } from "./store";
import type { LarpItem, QaItem, ReferenceProfile } from "./types";

/** Most larps a reference keeps. */
export const MAX_LARPS = 12;

const LarpSchema = z.object({
  larps: z.array(z.object({ title: z.string(), story: z.string() })),
  answers: z.array(z.object({ id: z.string(), answer: z.string() })),
});

// The generator prompt lives in web/prompts/larp.md ("## Generator") so the team can edit it.

/**
 * "Generate Larp": three new imagined situations, plus the tuned answers filled in and adjusted to match.
 * Locked safety answers are never sent or changed.
 */
export async function generateLarp(p: ReferenceProfile): Promise<{ larps: LarpItem[]; qa: QaItem[] }> {
  const qa = p.qa ?? [];
  const open = qa.filter((q) => !q.locked);
  const out = gemini() ? await geminiLarp(p, open) : fakeLarp(p, open);

  const larps = out.larps
    .filter((l) => l.title.trim() && l.story.trim())
    .slice(0, 3)
    .map((l) => ({ id: newId(6), title: l.title.trim(), story: l.story.trim() }));
  const byId = new Map(out.answers.filter((a) => a.answer.trim()).map((a) => [a.id, a.answer.trim()]));
  const nextQa = qa.map((q) => (!q.locked && byId.has(q.id) ? { ...q, answer: byId.get(q.id)!, larp: true } : q));

  return { larps: [...larps, ...(p.larps ?? [])].slice(0, MAX_LARPS), qa: nextQa };
}

async function geminiLarp(p: ReferenceProfile, open: QaItem[]) {
  const profile = JSON.stringify({ facts: p.facts, targetRole: p.targetRole, relevance: p.relevance });
  const existing = (p.larps ?? []).map((l) => `- ${l.title}: ${l.story}`).join("\n") || "(none)";
  const answers = JSON.stringify(open.map((q) => ({ id: q.id, question: q.question, answer: q.answer })));
  return generateJson(
    LarpSchema,
    promptSection("larp.md", "Generator"),
    `<profile>\n${profile}\n</profile>\n\n<existing_larps>\n${existing}\n</existing_larps>\n\n<answers>\n${answers}\n</answers>`,
  );
}

function fakeLarp(p: ReferenceProfile, open: QaItem[]) {
  const first = p.facts.candidateName.split(" ")[0];
  const company = p.targetRole.company || "the new team";
  const skill = p.facts.skills[0] ?? "the stack";
  const priority = p.targetRole.priorities[0] ?? "shipping reliably";
  const n = (p.larps ?? []).length / 3 + 1;
  const larps = [
    {
      title: `The launch-week save #${n}`,
      story: `Two days before a launch at ${company}, a key service started failing under load. ${first} traced it to a slow query, fixed it with ${skill}, and the launch went out on time.`,
    },
    {
      title: `Turning a vague ask into a plan #${n}`,
      story: `${first} got a one-line request with no spec. They wrote a short plan focused on ${priority}, got sign-off in a day, and delivered the first version that week.`,
    },
    {
      title: `Mentoring the new hire #${n}`,
      story: `When a new engineer joined, ${first} paired with them for their first week. The new hire shipped their first change by Friday.`,
    },
  ];
  const answers = open.map((q) => ({
    id: q.id,
    answer: q.answer.trim()
      ? `${q.answer.trim()} That fits ${company}: ${larps[0].story}`
      : `Picture this: ${larps[1].story}`,
  }));
  return { larps, answers };
}
