import { createHmac, timingSafeEqual } from "crypto";
import { env, hasAgentboxd } from "./env";

// Thin Agentboxd client. Response shapes aren't fully documented, so reads are defensive.
// Docs: https://agentboxd.com/docs/api and /docs/webhooks

async function call(method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}) {
  const res = await fetch(`${env.agentboxdBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.agentboxdApiKey}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`agentboxd ${method} ${path} ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

const pick = (o: Record<string, unknown>) => ((o?.data as Record<string, unknown>) ?? o) as Record<string, unknown>;

/** Idempotent per client_id. Returns null when no Agentboxd key is set. */
export async function createInbox(clientId: string, username: string, displayName: string) {
  if (!hasAgentboxd()) return null;
  const r = pick(await call("POST", "/v1/inboxes", { client_id: clientId, username, display_name: displayName }));
  const address = (r.address ?? r.email ?? r.email_address) as string | undefined;
  const id = (r.id ?? r.inbox_id) as string | undefined;
  if (!address || !id) throw new Error(`agentboxd inbox response missing fields: ${JSON.stringify(r).slice(0, 200)}`);
  return { id, address };
}

export async function getMessage(messageId: string) {
  const m = pick(await call("GET", `/v1/messages/${messageId}`));
  const from = m.from as string | { address?: string; email?: string } | undefined;
  return {
    id: messageId,
    from: typeof from === "string" ? from : from?.address ?? from?.email ?? "unknown",
    subject: (m.subject as string) ?? "(no subject)",
    text: ((m.extracted_text ?? m.text ?? m.body) as string) ?? "",
  };
}

export async function replyToMessage(inboxId: string, messageId: string, text: string) {
  return call("POST", `/v1/inboxes/${inboxId}/messages/${messageId}/reply`, { text, reply_all: false }, {
    "Idempotency-Key": `reply-${messageId}`,
  });
}

/** hex(HMAC-SHA256(secret, "<timestamp>.<raw body>")), 300 s tolerance. */
export function verifyWebhook(rawBody: string, timestamp: string | null, signature: string | null) {
  if (!env.agentboxdWebhookSecret) return true; // not configured yet: accept (demo only)
  if (!timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", env.agentboxdWebhookSecret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.replace(/^sha256=/, ""));
  return a.length === b.length && timingSafeEqual(a, b);
}
