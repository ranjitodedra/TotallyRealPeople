// Render Workflow service: answers hiring-manager emails as durable tasks.
// Deployed as its own Render "Workflow" service from this repo (see web/RENDER.md).
// Start command: npx tsx src/workflows/main.ts
//
// answerEmail
//   ├─ draftReply  (Gemini, retried on failure)
//   └─ sendReply   (Agentboxd, retried; idempotent per message, so retries never double-send)

import { task } from "@renderinc/sdk/workflows";
import { replyToMessage } from "../lib/agentboxd";
import { writeEmailReply, type InboundEmail, type ReplyProfile } from "../lib/email-reply";

export interface EmailJob {
  profile: ReplyProfile;
  inbound: InboundEmail;
  /** Where to send the reply. Missing for in-app demo emails, which are only drafted. */
  delivery?: { inboxId: string; messageId: string };
}

export const draftReply = task(
  { name: "draftReply", retry: { maxRetries: 3, waitDurationMs: 2000, backoffScaling: 2 }, timeoutSeconds: 120 },
  async (_ctx, profile: ReplyProfile, inbound: InboundEmail): Promise<string> => {
    const reply = await writeEmailReply(profile, inbound);
    if (!reply.trim()) throw new Error("empty reply"); // retry instead of sending nothing
    return reply;
  },
);

export const sendReply = task(
  { name: "sendReply", retry: { maxRetries: 5, waitDurationMs: 3000, backoffScaling: 2 }, timeoutSeconds: 60 },
  async (_ctx, inboxId: string, messageId: string, text: string): Promise<boolean> => {
    await replyToMessage(inboxId, messageId, text);
    return true;
  },
);

export const answerEmail = task(
  { name: "answerEmail", timeoutSeconds: 600 },
  async (ctx, job: EmailJob): Promise<{ reply: string; sent: boolean }> => {
    const reply = await ctx.run(draftReply, job.profile, job.inbound);
    if (!job.delivery) return { reply, sent: false };
    await ctx.run(sendReply, job.delivery.inboxId, job.delivery.messageId, reply);
    return { reply, sent: true };
  },
);
