import { replyToMessage } from "./agentboxd";
import { toReplyProfile, writeEmailReply, type InboundEmail } from "./email-reply";
import { getReference, newId, saveReference } from "./store";
import type { EmailMessage, ReferenceProfile } from "./types";
import { hasWorkflows, runEmailReply } from "./workflows";

export type Inbound = InboundEmail & { providerMessageId?: string; demo?: boolean };
export type Delivery = { inboxId: string; messageId: string };

/** Records an inbound question. Returns null if this provider message was already handled. */
export async function recordInbound(p: ReferenceProfile, inbound: Inbound) {
  if (inbound.providerMessageId && p.messages.some((m) => m.providerMessageId === inbound.providerMessageId)) {
    return null;
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
  return inMsg;
}

/**
 * Writes (and, with a delivery target, sends) the reply, then records it.
 * With Render Workflows configured this runs as a durable workflow (draft + send, each retried);
 * otherwise it runs inline in this request.
 */
export async function replyToInbound(p: ReferenceProfile, inbound: Inbound, delivery?: Delivery) {
  let reply: string;
  let workflowRunId: string | undefined;
  if (hasWorkflows()) {
    const r = await runEmailReply(
      { profile: toReplyProfile(p), inbound: { from: inbound.from, subject: inbound.subject, text: inbound.text }, delivery },
      delivery ? `email-${delivery.messageId}` : undefined,
    );
    reply = r.reply;
    workflowRunId = r.runId;
  } else {
    reply = await writeEmailReply(toReplyProfile(p), inbound);
    if (delivery) await replyToMessage(delivery.inboxId, delivery.messageId, reply);
  }

  // Reload: the profile may have changed while the reply was being written.
  const latest = (await getReference(p.id)) ?? p;
  const outMsg: EmailMessage = {
    id: newId(),
    direction: "outbound",
    from: latest.email?.address ?? "",
    to: inbound.from,
    subject: inbound.subject.startsWith("Re:") ? inbound.subject : `Re: ${inbound.subject}`,
    text: reply,
    at: new Date().toISOString(),
    demo: inbound.demo,
    workflowRunId,
  };
  latest.messages.push(outMsg);
  await saveReference(latest);
  return outMsg;
}

/** Record + reply in one go (used by the in-app demo, which waits for the answer). */
export async function handleInboundEmail(p: ReferenceProfile, inbound: Inbound, delivery?: Delivery) {
  const inMsg = await recordInbound(p, inbound);
  if (!inMsg) return { duplicate: true as const };
  return { duplicate: false as const, reply: await replyToInbound(p, inbound, delivery) };
}

/** Skip bounces, auto-replies and our own mail so the agent never loops. */
export function isAutomated(from: string, subject: string, ownAddress?: string) {
  const f = from.toLowerCase();
  if (ownAddress && f.includes(ownAddress.toLowerCase())) return true;
  if (/mailer-daemon|postmaster|no-?reply|donotreply/.test(f)) return true;
  return /^(auto(matic)? ?reply|out of (the )?office|undeliverable|delivery status|returned mail)/i.test(subject.trim());
}
