import { getMessage, replyToMessage, verifyWebhook } from "@/lib/agentboxd";
import { handleInboundEmail, isAutomated } from "@/lib/email-flow";
import { findByEmail, findByInboxId } from "@/lib/store";

// Agentboxd `message.received` webhook. Register with:
//   POST https://api.agentboxd.com/v1/webhooks
//   { "url": "https://<render-app>/api/webhooks/email", "events": ["message.received"], "payload": "envelope" }
// Put the returned secret in AGENTBOXD_WEBHOOK_SECRET.
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get("x-mailroom-timestamp"), req.headers.get("x-mailroom-signature"))) {
    return Response.json({ error: "bad signature" }, { status: 401 });
  }
  let evt: { type?: string; data?: Record<string, unknown> };
  try {
    evt = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  if (evt.type !== "message.received" || !evt.data) return Response.json({ ok: true, ignored: evt.type });

  const d = evt.data as Record<string, unknown>;
  const inbox = d.inbox as { id?: string; address?: string } | undefined;
  const inboxId = (d.inbox_id as string) ?? inbox?.id;
  const msg = d.message as Record<string, unknown> | undefined;
  const messageId = (d.message_id as string) ?? (msg?.id as string);
  if (!inboxId || !messageId) return Response.json({ ok: true, ignored: "missing ids" });

  const p = (await findByInboxId(inboxId)) ?? (inbox?.address ? await findByEmail(inbox.address) : null);
  if (!p) return Response.json({ ok: true, ignored: "unknown inbox" });

  // Envelope payloads have no body, so fetch it. Full payloads carry extracted_text.
  let from = (d.from as string) ?? "";
  let subject = (d.subject as string) ?? "";
  let text = (msg?.extracted_text as string) ?? "";
  if (!text) {
    const full = await getMessage(messageId);
    from ||= full.from;
    subject ||= full.subject;
    text = full.text;
  }
  if (isAutomated(from, subject, p.email?.address)) return Response.json({ ok: true, ignored: "automated" });

  try {
    const r = await handleInboundEmail(p, { from, subject, text, providerMessageId: messageId }, (reply) =>
      replyToMessage(inboxId, messageId, reply),
    );
    return Response.json({ ok: true, duplicate: r.duplicate });
  } catch (e) {
    console.error("email webhook failed", e);
    return Response.json({ error: "reply failed" }, { status: 500 });
  }
}
