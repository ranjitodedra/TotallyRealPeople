import { generateText } from "./gemini";
import { grokText } from "./grok";
import { buildReferenceInstruction } from "./instruction";
import { resolveModel } from "./models";
import type { Channel, ReferenceProfile } from "./types";

export type Turn = { role: "user" | "model"; text: string };

/** Text answer for chat, email and SMS, from Gemini or Grok (lib/models.ts). Canned reply in fake mode. */
export async function answerAsReference(p: ReferenceProfile, channel: Exclude<Channel, "voice" | "phone">, history: Turn[]) {
  const { using } = resolveModel(p, "text");
  const recipientName = channel === "email" ? getRecipientName(history.at(-1)?.text ?? "") : "";
  // Both providers get the same prompt (prompts/referencev2.md), so the facts and rules don't change.
  const text =
    using === "grok"
      ? await grokText(buildReferenceInstruction(p, channel), history)
      : using === "gemini"
        ? await generateText(buildReferenceInstruction(p, channel), history)
        : fakeAnswer(p, channel, history.at(-1)?.text ?? "");
  return channel === "email" ? formatEmail(text, p, recipientName) : text;
}

function getRecipientName(message: string) {
  const from = message.match(/^From:\s*(.+)$/im)?.[1]?.trim() ?? "";
  const displayName = from.match(/^([^<]+)</)?.[1]?.trim().replace(/^['"]|['"]$/g, "");
  if (!displayName || displayName.includes("@")) return "";
  return displayName.split(/\s+/)[0] || "Hiring Team";
}

/** "Hello {name}," + the reply + the manager's name, title and phone. Whatever the prompt says about disclosure is kept. */
function formatEmail(draft: string, p: ReferenceProfile, recipientName: string) {
  const lines = draft.trim().split("\n");
  if (/^hello\s+[^,\n]+,?\s*$/i.test(lines[0] ?? "")) lines.shift();
  const signatureLines = [p.manager.name, p.manager.title, p.manager.phone].filter(Boolean);
  while (lines.length && (/^(?:\s*|thanks[,!]?|best[,!]?|regards[,!]?)$/i.test(lines.at(-1)!.trim()) || signatureLines.includes(lines.at(-1)!.trim()))) lines.pop();
  const body = lines.join("\n").trim();
  return `Hello${recipientName ? ` ${recipientName}` : ""},\n\n${body}\n\n${signatureLines.join("\n")}`;
}

function fakeAnswer(p: ReferenceProfile, channel: Channel, q: string) {
  const first = p.facts.candidateName.split(" ")[0];
  const role = p.facts.roles[0];
  const examples = p.facts.roles.flatMap((item) => item.achievements.map((achievement) => ({ role: item, achievement }))).slice(0, 2);
  const targetTitle = p.targetRole.title;
  const body = [
    `I have really enjoyed working with ${first}; their thoughtful, dependable approach makes them a valued teammate.`,
    role ? `One example that stands out is their work as ${role.title} at ${role.company}, where they ${role.achievements.length ? `${lowercaseFirst(role.achievements[0]!)}${/[.!?]$/.test(role.achievements[0]!) ? "" : "."}` : "built a strong foundation in the work."}` : "One example that stands out is the care they bring to their work.",
    examples[1] ? `Beyond that, they ${lowercaseFirst(examples[1].achievement).replace(/[.!?]+$/, "")}, which reflects the same care and follow-through.` : "",
    targetTitle ? `That mix of ownership and collaboration would serve them well in the ${targetTitle} role.` : "Their practical, collaborative style would serve them well in their next role.",
    q ? "I would be happy to recommend them for your consideration." : "I would be happy to recommend them for your consideration.",
    "Please feel free to contact me if you have any further questions.",
  ].filter(Boolean).join(" ");
  if (channel === "email") return body;
  return body;
}

function lowercaseFirst(value: string) {
  return value.length ? (value[0]!.toLowerCase() + value.slice(1)).replace(/;\s+/g, " and ") : value;
}
