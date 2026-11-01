import { LARP_ENABLED } from "./features";
import { MANAGER } from "./manager";
import { promptSection } from "./prompt-file";
import type { AgentCustom, Channel, ReferenceProfile } from "./types";

/** All prompt wording lives in this one file (web/prompts/). This builder only adds the candidate's data. */
const PROMPT_FILE = "referencev2.md";

/**
 * The one prompt builder. Voice, email, chat (and the phone bridge) all use this,
 * so every channel speaks from the same facts.
 */
export function buildReferenceInstruction(p: ReferenceProfile, channel: Channel): string {
  const style = withAgent(p.agent);
  const f = p.facts;
  const first = f.candidateName.split(" ")[0] || f.candidateName;
  const d = asData;

  const roles = f.roles
    .map((r) => {
      const dates = [r.startDate, r.endDate].filter((x): x is string => !!x).map(d).join(" – ") || "dates not given";
      const ach = r.achievements.map((a) => `    - ${d(a)}`).join("\n");
      return `  - ${d(r.title)} at ${d(r.company)} (${dates})${ach ? "\n" + ach : ""}`;
    })
    .join("\n");

  // Every section is optional: a missing "## Heading" is skipped (with a server warning) instead of failing the call.
  const md = (heading: string) =>
    optionalSection(heading)
      .replaceAll("{manager_name}", d(p.manager.name))
      .replaceAll("{manager_title}", d(p.manager.title))
      .replaceAll("{manager_company}", d(p.manager.company))
      .replaceAll("{candidate_name}", d(f.candidateName))
      .replaceAll("{candidate_first}", d(first))
      .replaceAll("{tone}", style.tone)
      .replaceAll("{focus_areas}", style.focusAreas.join(", "));

  const sections = [
    block("IDENTITY", md("Identity")),

    block("HOW TO READ THIS PROMPT", md("How to read this prompt")),

    block("COMMUNICATION STYLE", md("Style"), ...style.habits.map((h) => `- ${h}`)),

    `CANDIDATE FACTS (from the candidate's own résumé, reviewed by them)
<candidate_facts>
Name: ${d(f.candidateName)}${f.headline ? `\nHeadline: ${d(f.headline)}` : ""}
Roles:
${roles || "  (none listed)"}
Skills: ${f.skills.map(d).join(", ") || "(none listed)"}
Education: ${f.education.map(d).join("; ") || "(none listed)"}
</candidate_facts>`,

    `TARGET ROLE
<target_role>
${d(p.targetRole.title)}${p.targetRole.company ? ` at ${d(p.targetRole.company)}` : ""}
Priorities: ${p.targetRole.priorities.map(d).join("; ") || "(not given)"}
</target_role>`,

    `HOW THE EXPERIENCE CONNECTS
<connections>
${p.relevance.map((r) => `- ${d(r)}`).join("\n") || "- (none worked out yet)"}
</connections>`,

    `WHAT YOU CANNOT SPEAK TO
<unknowns>
${p.unknowns.map((u) => `- ${d(u)}`).join("\n") || "- Anything not in the facts above."}
</unknowns>`,

    candidateAnswers(p, md),

    larpSection(p, md),

    block("BOUNDARIES", md("Boundaries")),

    block("EXAMPLE ANSWERS", md("Example answers")),

    block("QUESTION GUIDE", md("Question guide")),

    block("CHANNEL", ...channelRules(channel, md)),
  ];

  return sections.filter(Boolean).join("\n\n");
}

/** Tone and focus areas: the user's create-screen edits, else the defaults in manager.ts. Extra habits come only from the API. */
function withAgent(agent?: AgentCustom) {
  const clean = (xs?: string[]) => xs?.map(asData).filter((x) => x.trim()) ?? [];
  return {
    tone: agent?.tone?.trim() ? asData(agent.tone) : MANAGER.tone,
    focusAreas: clean(agent?.focusAreas).length ? clean(agent?.focusAreas) : MANAGER.focusAreas,
    habits: clean(agent?.habits),
  };
}

type Md = (heading: string) => string;

/** One "## Heading" section of the prompt file, or "" when the file has no such heading. */
function optionalSection(heading: string) {
  try {
    return promptSection(PROMPT_FILE, heading);
  } catch {
    console.warn(`[prompt] prompts/${PROMPT_FILE} has no "## ${heading}" section; leaving it out.`);
    return "";
  }
}

/** A titled prompt block from its non-empty parts, or "" when every part is empty. */
function block(title: string, ...parts: string[]) {
  const body = parts.filter((x) => x.trim()).join("\n");
  return body ? `${title}\n${body}` : "";
}

function candidateAnswers(p: ReferenceProfile, md: Md) {
  const qa = (p.qa ?? []).filter((q) => q.question.trim());
  if (qa.length === 0) return "";
  const rows = qa
    .map(
      (q) =>
        `Q: ${asData(q.question)}\nA: ${q.answer.trim() ? `${q.larp ? "[imagined] " : ""}${asData(q.answer)}` : "(not answered: say you don't have that information)"}`,
    )
    .join("\n\n");
  return block("CANDIDATE'S OWN ANSWERS", md("Candidate answers"), `<candidate_answers>\n${rows}\n</candidate_answers>`);
}

/** "Generate Larp" stories, with the "## Imagined situations" rules on how to tell them. */
function larpSection(p: ReferenceProfile, md: Md) {
  const larps = LARP_ENABLED ? (p.larps ?? []) : [];
  if (larps.length === 0) return "";
  const rows = larps.map((l) => `- ${asData(l.title)}: ${asData(l.story)}`).join("\n");
  return block("IMAGINED SITUATIONS", md("Imagined situations"), `<larps>\n${rows}\n</larps>`);
}

/** Document text can't open or close our tags. */
function asData(s: string) {
  return s.replace(/[<>]/g, "");
}

// Each channel's rules, including its AI disclosure (email signature, phone opening line), live in the prompt file.
// Outside the prompt, code still adds the TwiML <Say> fallback and the prefix on the first text.
function channelRules(channel: Channel, md: Md): string[] {
  switch (channel) {
    case "voice":
      return [md("Voice")];
    case "email":
      return [md("Email")];
    case "chat":
      return [md("Chat")];
    // Phone and SMS answers came out generic ("Alex is a strong engineer"), so both add "## Be specific".
    case "phone":
      return [md("Phone"), md("Be specific")];
    case "sms":
      return [md("SMS"), md("Be specific")];
  }
}

/** Spoken by Twilio when a call can't reach the reference (no reference set up, no Gemini key). */
export const PHONE_DISCLOSURE = "You've reached an AI reference simulation from TotallyRealPeople. It is not a real person.";

/**
 * Sent as the first turn so the Live model speaks first (it otherwise waits for the caller).
 * The opening line itself comes from "## Phone" in the prompt file.
 */
export const PHONE_GREETING = "(Your phone is ringing. Someone you don't know is calling you, and you just picked up. Answer it.)";

/** Put in front of the first text reply in each SMS conversation. */
export function smsDisclosure(p: ReferenceProfile) {
  const first = p.facts.candidateName.split(" ")[0] || p.facts.candidateName;
  return `[AI reference simulation · TotallyRealPeople: an AI playing ${p.manager.name}, ${first}'s reference. Not a real person.]`;
}
