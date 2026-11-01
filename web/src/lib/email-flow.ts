import { answerAsReference } from "./answer";
import { newId, saveReference } from "./store";
import type { EmailMessage, ReferenceProfile } from "./types";

/** Records an inbound question, writes the reply with the shared prompt, records the reply. */
export async function handleInboundEmail(
  p: ReferenceProfile,
  inbound: { from: string; subject: string; text: string; providerMessageId?: string; demo?: boolean },
  send?: (replyText: string) => Promise<unknown>,
) {
  if (inbound.providerMessageId && p.messages.some((m) => m.providerMessageId === inbound.providerMessageId)) {
    return { duplicate: true as const };
  }
  const inMsg: EmailMessage = {
    id: newId(),
    direction: "inbound",
    from: inbound.from,
    to: p.email?.address ?? "",
    subject: inbound.subject,
    text: inbound.text.slice(0, 8000),
    at: new Date().toISOString(),
    providerMessageId: inbound.providerMessageId,
    demo: inbound.demo,
  };
  p.messages.push(inMsg);
  await saveReference(p);

  const reply = await answerAsReference(p, "email", [
    { role: "user", text: `From: ${inbound.from}\nSubject: ${inbound.subject}\n\n${inMsg.text}` },
  ]);
  if (send) await send(reply);

  const outMsg: EmailMessage = {
    id: newId(),
    direction: "outbound",
    from: p.email?.address ?? "",
    to: inbound.from,
    subject: inbound.subject.startsWith("Re:") ? inbound.subject : `Re: ${inbound.subject}`,
    text: reply,
    at: new Date().toISOString(),
    demo: inbound.demo,
  };
  p.messages.push(outMsg);
  await saveReference(p);
  return { duplicate: false as const, reply: outMsg };
}

/** Skip bounces, auto-replies and our own mail so the agent never loops. */
export function isAutomated(from: string, subject: string, ownAddress?: string) {
  const f = from.toLowerCase();
  if (ownAddress && f.includes(ownAddress.toLowerCase())) return true;
  if (/mailer-daemon|postmaster|no-?reply|donotreply/.test(f)) return true;
  return /^(auto(matic)? ?reply|out of (the )?office|undeliverable|delivery status|returned mail)/i.test(subject.trim());
}
