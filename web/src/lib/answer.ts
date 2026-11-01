import { gemini, generateText } from "./gemini";
import { buildReferenceInstruction } from "./instruction";
import type { Channel, ReferenceProfile } from "./types";

export type Turn = { role: "user" | "model"; text: string };

/** Text answer for chat and email. Falls back to a canned reply in fake mode. */
export async function answerAsReference(p: ReferenceProfile, channel: Exclude<Channel, "voice" | "phone">, history: Turn[]) {
  if (gemini()) return generateText(buildReferenceInstruction(p, channel), history);
  return fakeAnswer(p, channel, history.at(-1)?.text ?? "");
}

function fakeAnswer(p: ReferenceProfile, channel: Channel, q: string) {
  const first = p.facts.candidateName.split(" ")[0];
  const role = p.facts.roles[0];
  const ach = role?.achievements[0];
  const body = [
    `[Fake mode: add GEMINI_API_KEY for real answers.]`,
    `I'm ${p.manager.name}, an AI reference simulation for ${first}.`,
    role ? `${first} worked as ${role.title} at ${role.company}.` : "",
    ach ? `One documented example: ${ach}.` : "",
    q ? `You asked: "${q.slice(0, 140)}". I'd only answer that from the résumé's facts.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  if (channel === "email") return `${body}\n\n${p.manager.name}\n${p.manager.title} (AI reference simulation · TotallyRealPeople)`;
  return body;
}
